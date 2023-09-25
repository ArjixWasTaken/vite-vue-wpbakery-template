<?php

namespace MyPlugin\Classes;

class Assets
{
	public function load() {
		Vite::enqueueScript('myplugin-script-boot', 'main.ts', [], WPM_VERSION);
		wp_add_inline_script( 'myplugin-script-boot', strtr('
            if (!("__VARS__" in window)) {
                window.__VARS__ = {
                    isAdmin: #isAdmin,
                    nonce: "#nonce",
                    rest: "#rest"
                }
            }
            
            window._app_ ||= {};
            window._app_.load = new Promise(resolve => {
                const inner = () => {
                    if ("components" in window._app_ && (resolve() || true)) return;
                    setTimeout(inner, 20);
                }
                inner();
            });
        ', [
            "#isAdmin" => (str_starts_with($_SERVER["REQUEST_URI"], "/wp-admin") ||
                ((function_exists("vc_is_inline") && vc_is_inline())))
                    ? "true"
                    : "false",
            "#nonce" => wp_create_nonce('wp_rest'),
            "#rest" => get_rest_url() . 'myplugin/v1'
        ]), 'before');
	}
}
