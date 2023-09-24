<?php

namespace MyPlugin\Classes;

class Assets
{
	public function load() {
		Vite::enqueueScript('MyPlugin-script-boot', 'main.ts', [], WPM_VERSION);
	}
}
