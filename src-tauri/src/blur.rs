#![allow(deprecated, unexpected_cfgs)]

use objc::{msg_send, sel, sel_impl};
use std::ffi::c_void;

type CGSConnectionID = i32;
type CGSWindowID = i32;
type CGError = i32;
type CGSSetWindowBackgroundBlurRadiusFn =
    unsafe extern "C" fn(CGSConnectionID, CGSWindowID, i32) -> CGError;

extern "C" {
    fn CGSDefaultConnectionForThread() -> CGSConnectionID;
}

fn load_blur_fn() -> Option<CGSSetWindowBackgroundBlurRadiusFn> {
    unsafe {
        let bundle_url = core_foundation::url::CFURL::from_path(
            "/System/Library/Frameworks/ApplicationServices.framework",
            true,
        )?;
        let bundle = core_foundation::bundle::CFBundle::new(bundle_url)?;
        let name = core_foundation::string::CFString::new("CGSSetWindowBackgroundBlurRadius");
        let ptr = bundle.function_pointer_for_name(name);
        if ptr.is_null() {
            return None;
        }
        Some(std::mem::transmute::<*const c_void, CGSSetWindowBackgroundBlurRadiusFn>(ptr))
    }
}

/// Apply a background blur with the given radius to a Tauri webview window.
/// Uses the private `CGSSetWindowBackgroundBlurRadius` API (same as iTerm2).
pub fn set_window_blur_radius(
    window: &tauri::WebviewWindow,
    radius: u32,
) -> Result<(), String> {
    let blur_fn =
        load_blur_fn().ok_or("Failed to load CGSSetWindowBackgroundBlurRadius")?;

    unsafe {
        let ns_window = window.ns_window().map_err(|e| format!("{e}"))? as cocoa::base::id;
        let window_number: i64 = msg_send![ns_window, windowNumber];
        let connection = CGSDefaultConnectionForThread();
        let err = blur_fn(connection, window_number as CGSWindowID, radius as i32);
        if err != 0 {
            return Err(format!("CGSSetWindowBackgroundBlurRadius returned error {err}"));
        }
    }

    Ok(())
}
