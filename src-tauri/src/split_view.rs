#![allow(deprecated, unexpected_cfgs)]

use cocoa::base::id;
use cocoa::foundation::NSUInteger;
use objc::{msg_send, sel, sel_impl};

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

        // macOS requires NSWindowStyleMaskResizable for drag-to-tile.
        // Since decorations are off, no resize handles are visible.
        let mask: NSUInteger = msg_send![ns_window, styleMask];
        let _: () = msg_send![ns_window, setStyleMask: mask | NS_WINDOW_STYLE_MASK_RESIZABLE];
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
