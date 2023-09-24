<?php

/**
 * Plugin Name: MyPlugin
 * Description: ...
 * Author: ArjixWasTaken <53124886+ArjixWasTaken@users.noreply.github.com>
 * Version: 1.0.0
 */

define('WPM_URL', plugin_dir_url(__FILE__));
define('WPM_DIR', plugin_dir_path(__FILE__));

define('WPM_DEVELOPMENT', 'no');
define('WPM_VERSION', '1.0.0');

class MyPlugin
{
    private static $instance;
    public static function get_instance()
    {
        if (null == self::$instance) {
            self::$instance = new MyPlugin();
            self::$instance->boot();
        }

        return self::$instance;
    }

    public function boot()
    {
        $this->loadClasses();
        (new \MyPlugin\Classes\Shortcodes())->Init();

        $this->disableUpdateNag();
        add_action("admin_menu", [$this, 'admin_menu']);

        $this->vars();
        (new \MyPlugin\Classes\Assets())->load();
    }

    public function admin_menu()
    {
        add_menu_page(
            "My Plugin",
            "My Plugin",
            "manage_options",
            'myplugin-dashboard',
            function () { ?>
            <div id="myplugin-root"></div>
            <script type="module">
                await _app_.load;
                _app_
                    .create(_app_.adminComponents.Dashboard)
                    .mount("#myplugin-root");
            </script>
        <?php },
            'data:image/svg+xml;base64,' . base64_encode('
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M11,14C12,14 13.05,14.16 14.2,14.44C13.39,15.31 13,16.33 13,17.5C13,18.39 13.25,19.23 13.78,20H3V18C3,16.81 3.91,15.85 5.74,15.12C7.57,14.38 9.33,14 11,14M11,12C9.92,12 9,11.61 8.18,10.83C7.38,10.05 7,9.11 7,8C7,6.92 7.38,6 8.18,5.18C9,4.38 9.92,4 11,4C12.11,4 13.05,4.38 13.83,5.18C14.61,6 15,6.92 15,8C15,9.11 14.61,10.05 13.83,10.83C13.05,11.61 12.11,12 11,12M18.5,10H20L22,10V12H20V17.5A2.5,2.5 0 0,1 17.5,20A2.5,2.5 0 0,1 15,17.5A2.5,2.5 0 0,1 17.5,15C17.86,15 18.19,15.07 18.5,15.21V10Z" />
                </svg>
            ')
        );
    }

    public function disableUpdateNag()
    {
        add_action('admin_init', function () {
            if (isset($_GET['page']) && str_starts_with($_GET['page'], 'myplugin-')) {
                remove_all_actions('admin_notices');
            }
        }, 20);
    }

    public function vars()
    { ?>
        <script>
            if (!("__VARS__" in window)) {
                window.__VARS__ = {
                    isAdmin: <?php echo str_starts_with($_SERVER["REQUEST_URI"], '/wp-admin') ? "true" : ((function_exists('vc_is_inline') && vc_is_inline()) ? "true" : "false") ?>,
                    nonce: "<?php echo wp_create_nonce('wp_rest') ?>"
                };
            }

            if (!("_app_" in window))
                window._app_ = {};

            window._app_.load = new Promise(resolve => {
                const inner = () => {
                    if (window._app_ && "components" in window._app_ && (resolve() || true)) return;
                    setTimeout(inner, 20);
                }
                inner();
            });
        </script>

    <?php }

    public function loadClasses()
    {
        require WPM_DIR . 'includes/autoload.php';
    }

    public static function ActivatePlugin()
    {
        require_once(WPM_DIR . 'includes/Classes/Activator.php');
        $activator = new \MyPlugin\Classes\Activator();
        $activator->migrateDatabases(false);
    }
}

MyPlugin::ActivatePlugin();
add_action('init', ['MyPlugin', 'get_instance']);
