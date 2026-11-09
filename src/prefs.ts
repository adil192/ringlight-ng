import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const GLOW_SIZES = ['small', 'medium', 'large'];

export default class RinglightPreferences extends ExtensionPreferences {
	// oxlint-disable-next-line typescript/no-deprecated
	override fillPreferencesWindow(window: Adw.PreferencesWindow) {
		const settings = this.getSettings();
		const page = new Adw.PreferencesPage();
		window.add(page);

		const lightGroup = new Adw.PreferencesGroup({ title: 'Light' });
		lightGroup.add(
			switchRow(
				'Follow camera',
				'Turn the glow on whenever an app opens the webcam',
				settings,
				'auto-mode',
			),
		);
		lightGroup.add(scaleRow('Brightness', null, settings, 'brightness'));
		lightGroup.add(scaleRow('Colour', 'Warm amber at 0, cool white at 1', settings, 'color-temp'));
		page.add(lightGroup);

		const shapeGroup = new Adw.PreferencesGroup({ title: 'Shape' });
		shapeGroup.add(choiceRow(
			'Glow size',
			'How far the glow reaches in from the edge',
			['Small', 'Medium', 'Large'],
			GLOW_SIZES,
			settings,
			'glow-size',
		));
		page.add(shapeGroup);

		return Promise.resolve();
	}

}

function switchRow(title: string, subtitle: string, settings: Gio.Settings, key: string) {
	const row = new Adw.SwitchRow({ title, subtitle });
	settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
	return row;
}

function scaleRow(title: string, subtitle: string | null, settings: Gio.Settings, key: string) {
	const row = new Adw.ActionRow({ title, subtitle });
	const scale = new Gtk.Scale({
		adjustment: new Gtk.Adjustment({ lower: 0, upper: 1, step_increment: 0.05 }),
		digits: 2,
		draw_value: true,
		hexpand: true,
		width_request: 220,
		valign: Gtk.Align.CENTER,
	});
	settings.bind(key, scale.adjustment, 'value', Gio.SettingsBindFlags.DEFAULT);
	row.add_suffix(scale);
	return row;
}

function choiceRow(title: string, subtitle: string, labels: string[], values: string[], settings: Gio.Settings, key: string) {
	if (labels.length !== values.length) throw new Error(`labels and values are incongruent: ${labels} vs ${values}`);

	const row = new Adw.ComboRow({
		title,
		subtitle,
		model: Gtk.StringList.new(labels),
		selected: Math.max(0, values.indexOf(settings.get_string(key))),
	});
	row.connect('notify::selected', () => settings.set_string(key, values[row.selected]!));
	return row;
}
