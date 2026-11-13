package com.derrellwilliams.wavelane;

import android.app.admin.DeviceAdminReceiver;

/**
 * Lets Wavelane be the tablet's device owner (set once over adb), which is what allows it to stay
 * the home screen on Fire OS, where the Fire launcher is protected and can't be switched off.
 * It asks for no policies beyond that; the app can give the role up again from Settings.
 */
public class WavelaneAdmin extends DeviceAdminReceiver {}
