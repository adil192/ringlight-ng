import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';

import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { Slider } from 'resource:///org/gnome/shell/ui/slider.js';

import type RinglightExtension from './extension.js';

export function create_indicator(ext: RinglightExtension) {
	const settings = ext._settings!;
	const ringlight_gicon = Gio.icon_new_for_string(
		GLib.build_filenamev([ext.path, 'icons', 'ringlight-symbolic.svg']),
	);

	const indicator = new PanelMenu.Button(0.5, 'Ringlight');
	indicator.add_child(
		new St.Icon({
			gicon: ringlight_gicon,
			style_class: 'system-status-icon',
		}),
	);

	// oxlint-disable-next-line typescript/no-unsafe-type-assertion (Asserts not a PopupDummyMenu)
	const menu = indicator.menu as PopupMenu.PopupMenu;

	const enabledToggle = new PopupMenu.PopupSwitchMenuItem(
		'Ring Light',
		settings.get_boolean('enabled'),
	);
	enabledToggle.connect('toggled', (_, on: boolean) => settings.set_boolean('enabled', on));
	menu.addMenuItem(enabledToggle);

	const autoModeToggle = new PopupMenu.PopupSwitchMenuItem(
		'Follow camera',
		settings.get_boolean('auto-mode'),
	);
	autoModeToggle.connect('toggled', (_, on: boolean) => settings.set_boolean('auto-mode', on));
	menu.addMenuItem(autoModeToggle);

	menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

	const row = new PopupMenu.PopupBaseMenuItem({ activate: false });
	row.add_child(
		new St.Icon({
			gicon: ringlight_gicon,
			style_class: 'popup-menu-icon',
		}),
	);
	const slider = new Slider(settings.get_double('brightness'));
	slider.connect('notify::value', () => settings.set_double('brightness', slider.value));
	row.add_child(slider);
	menu.addMenuItem(row);

	menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
	const prefs = new PopupMenu.PopupMenuItem('Settings…');
	prefs.connect('activate', () => ext.openPreferences());
	menu.addMenuItem(prefs);

	// Keep the popup in step with changes made from the prefs window.
	const changedId = settings.connect('changed', () => {
		enabledToggle.setToggleState(settings.get_boolean('enabled'));
		autoModeToggle.setToggleState(settings.get_boolean('auto-mode'));
		const brightness = settings.get_double('brightness');
		if (Math.abs(slider.value - brightness) > 0.001) slider.value = brightness;
	});
	indicator.connect('destroy', () => settings.disconnect(changedId));

	return indicator;
}
