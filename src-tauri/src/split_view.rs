#![allow(deprecated, unexpected_cfgs)]

use cocoa::base::id;
use cocoa::foundation::NSUInteger;
use objc::{msg_send, sel, sel_impl};

// NSWindowCollectionBehavior flags
const NS_WINDOW_COLLECTION_BEHAVIOR_FULL_SCREEN_PRIMARY: NSUInteger = 1 << 7;
const NS_WINDOW_COLLECTION_BEHAVIOR_FULL_SCREEN_AUXILIARY: NSUInteger = 1 << 8;
const NS_WINDOW_COLLECTION_BEHAVIOR_FULL_SCREEN_NONE: NSUInteger = 1 << 9;

// NSWindowStyleMask fullscreen flag
const NS_WINDOW_STYLE_MASK_FULL_SCREEN: NSUInteger = 1 << 14;

/// Configure the main window to be eligible as a Split View secondary tile.
/// Call once during app setup.
pub fn configure_for_split_view(window: &tauri::WebviewWindow) {
    unsafe {
        let ns_window = window.ns_window().unwrap() as id;
        let current_behavior: NSUInteger = msg_send![ns_window, collectionBehavior];
        let new_behavior = (current_behavior
            & !NS_WINDOW_COLLECTION_BEHAVIOR_FULL_SCREEN_NONE
            & !NS_WINDOW_COLLECTION_BEHAVIOR_FULL_SCREEN_AUXILIARY)
            | NS_WINDOW_COLLECTION_BEHAVIOR_FULL_SCREEN_PRIMARY;
        let _: () = msg_send![ns_window, setCollectionBehavior: new_behavior];
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
