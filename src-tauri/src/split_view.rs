#![allow(deprecated, unexpected_cfgs)]

use cocoa::base::id;
use cocoa::foundation::{NSString, NSUInteger};
use objc::{msg_send, sel, sel_impl};
use tauri::Manager;

// NSWindowCollectionBehavior flags
const NS_WINDOW_COLLECTION_BEHAVIOR_FULL_SCREEN_PRIMARY: NSUInteger = 1 << 7;
const NS_WINDOW_COLLECTION_BEHAVIOR_FULL_SCREEN_NONE: NSUInteger = 1 << 9;
const NS_WINDOW_COLLECTION_BEHAVIOR_FULL_SCREEN_ALLOWS_TILING: NSUInteger = 1 << 11;
const NS_WINDOW_COLLECTION_BEHAVIOR_FULL_SCREEN_DISALLOWS_TILING: NSUInteger = 1 << 12;

// NSWindowStyleMask flags
const NS_WINDOW_STYLE_MASK_RESIZABLE: NSUInteger = 1 << 3;
const NS_WINDOW_STYLE_MASK_FULL_SCREEN: NSUInteger = 1 << 14;

/// Configure the main window to be eligible as a Split View tile.
/// Call once during app setup.
///
/// The window is kept resizable at all times so macOS can perform native
/// split view tiling when the window is dragged onto a fullscreen space
/// via Mission Control.  To prevent the invisible ~3-5 px resize tracking
/// zones from swallowing clicks on mascots, call
/// `install_resize_guard` once after this.
pub fn configure_for_split_view(window: &tauri::WebviewWindow) {
    unsafe {
        let ns_window = window.ns_window().unwrap() as id;

        // Enable fullscreen + tiling collection behaviors so macOS offers
        // split view when the window is dragged onto a fullscreen space.
        let current_behavior: NSUInteger = msg_send![ns_window, collectionBehavior];
        let new_behavior = (current_behavior
            & !NS_WINDOW_COLLECTION_BEHAVIOR_FULL_SCREEN_NONE
            & !NS_WINDOW_COLLECTION_BEHAVIOR_FULL_SCREEN_DISALLOWS_TILING)
            | NS_WINDOW_COLLECTION_BEHAVIOR_FULL_SCREEN_PRIMARY
            | NS_WINDOW_COLLECTION_BEHAVIOR_FULL_SCREEN_ALLOWS_TILING;
        let _: () = msg_send![ns_window, setCollectionBehavior: new_behavior];

        // Keep resizable so macOS native tiling works in Mission Control.
        let mask: NSUInteger = msg_send![ns_window, styleMask];
        let _: () = msg_send![ns_window, setStyleMask: mask | NS_WINDOW_STYLE_MASK_RESIZABLE];
    }
}

/// Install an NSEvent local monitor that prevents the invisible resize
/// tracking zones (created by NSWindowStyleMaskResizable) from swallowing
/// mouseDown events near the window edges.  When a left-click lands inside
/// the ~5 px resize zone of the main window and we are NOT in fullscreen,
/// the monitor re-sends it as a click on the content view so mascots
/// receive the event.
pub fn install_resize_guard(window: &tauri::WebviewWindow) {
    use objc::runtime::Class;

    unsafe {
        let ns_window = window.ns_window().unwrap() as id;

        // Store the NSWindow pointer in a raw form the block can capture.
        let win_ptr = ns_window as usize;

        let mask: u64 = 1 << 1; // NSEventMaskLeftMouseDown
        let block = block::ConcreteBlock::new(move |event: id| -> id {
            let target_window: id = msg_send![event, window];
            if target_window as usize != win_ptr {
                return event;
            }
            // In fullscreen, let AppKit handle everything normally.
            let style: NSUInteger = msg_send![target_window, styleMask];
            if style & NS_WINDOW_STYLE_MASK_FULL_SCREEN != 0 {
                return event;
            }

            // Check if the click is in a resize zone (within 5 px of any edge).
            let loc: cocoa::foundation::NSPoint = msg_send![event, locationInWindow];
            let frame: cocoa::foundation::NSRect = msg_send![target_window, frame];
            let w = frame.size.width;
            let h = frame.size.height;
            let margin = 5.0_f64;

            let in_resize_zone = loc.x < margin
                || loc.x > w - margin
                || loc.y < margin
                || loc.y > h - margin;

            if !in_resize_zone {
                return event;
            }

            // Re-send the click to the content view so mascots receive it.
            let content_view: id = msg_send![target_window, contentView];
            let _: () = msg_send![content_view, mouseDown: event];

            // Return nil to swallow the original event (we already dispatched it).
            cocoa::base::nil
        });
        let block = block.copy();

        let ns_event_class = Class::get("NSEvent").unwrap();
        let _monitor: id = msg_send![
            ns_event_class,
            addLocalMonitorForEventsMatchingMask: mask
            handler: &*block
        ];
        // Leak the block and monitor intentionally — they live for the app lifetime.
        std::mem::forget(block);
    }
}

/// Listen for macOS space changes and auto-enter fullscreen when the window
/// is placed on a fullscreen space (e.g. via Mission Control drag).
pub fn observe_space_changes(app: tauri::AppHandle) {
    use objc::runtime::Class;
    use std::sync::OnceLock;

    static APP: OnceLock<tauri::AppHandle> = OnceLock::new();
    let _ = APP.set(app);

    unsafe {
        // Create a one-off ObjC class to receive the notification.
        let superclass = Class::get("NSObject").unwrap();
        if Class::get("SpacebarSpaceObserver").is_none() {
            let mut decl =
                objc::declare::ClassDecl::new("SpacebarSpaceObserver", superclass).unwrap();

            extern "C" fn space_changed(
                _this: &objc::runtime::Object,
                _sel: objc::runtime::Sel,
                _note: id,
            ) {
                let Some(app) = APP.get() else { return };
                let Some(window) = app.get_webview_window("main") else {
                    return;
                };
                if is_fullscreen(&window) {
                    return; // already in fullscreen
                }
                if !is_on_fullscreen_space(&window) {
                    return; // not on a fullscreen space
                }
                // Enter fullscreen — same logic as toggle_split_view
                let _ = window.set_always_on_top(false);
                let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);
                unsafe {
                    let ns_window = window.ns_window().unwrap() as id;
                    let _: () = msg_send![ns_window, toggleFullScreen: cocoa::base::nil];
                }
            }

            decl.add_method(
                sel!(spaceChanged:),
                space_changed as extern "C" fn(&objc::runtime::Object, objc::runtime::Sel, id),
            );
            decl.register();
        }

        let cls = Class::get("SpacebarSpaceObserver").unwrap();
        let observer: id = msg_send![cls, new];

        let workspace: id = msg_send![Class::get("NSWorkspace").unwrap(), sharedWorkspace];
        let nc: id = msg_send![workspace, notificationCenter];
        let name: id = cocoa::foundation::NSString::alloc(cocoa::base::nil)
            .init_str("NSWorkspaceActiveSpaceDidChangeNotification");
        let _: () = msg_send![nc,
            addObserver: observer
            selector: sel!(spaceChanged:)
            name: name
            object: cocoa::base::nil
        ];
        // Observer lives for the app lifetime — intentionally not removed.
        let _ = observer;
    }
}

/// Check if the main window is currently in fullscreen (Split View).
pub fn is_fullscreen(window: &tauri::WebviewWindow) -> bool {
    unsafe {
        let ns_window = window.ns_window().unwrap() as id;
        let mask: NSUInteger = msg_send![ns_window, styleMask];
        mask & NS_WINDOW_STYLE_MASK_FULL_SCREEN != 0
    }
}

/// Check if the window is on a fullscreen space (menu bar hidden).
/// On macOS, fullscreen spaces hide the menu bar, so frame ≈ visibleFrame.
pub fn is_on_fullscreen_space(window: &tauri::WebviewWindow) -> bool {
    unsafe {
        let ns_window = window.ns_window().unwrap() as id;
        let screen: id = msg_send![ns_window, screen];
        if screen == cocoa::base::nil {
            return false;
        }
        let frame: cocoa::foundation::NSRect = msg_send![screen, frame];
        let visible: cocoa::foundation::NSRect = msg_send![screen, visibleFrame];
        // Menu bar is ~24px; on fullscreen spaces it's hidden (difference < 5px)
        let menu_bar = (frame.size.height - visible.size.height)
            - (visible.origin.y - frame.origin.y);
        menu_bar.abs() < 5.0
    }
}
