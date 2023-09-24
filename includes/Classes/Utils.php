<?php

namespace MyPlugin\Classes;

class Utils {
    /**
     * Source: https://www.uuidgenerator.net/dev-corner/php
     */
    public static function guidv4($data = null) {
        $data = $data ?? random_bytes(16);

        $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
        $data[8] = chr(ord($data[8]) & 0x3f | 0x80);

        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}