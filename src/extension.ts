import Gio from 'gi://Gio';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

import { drawGlow, GLOW_FRACTION } from './glow.js';
import { create_indicator } from './indicator.js';

export default class RinglightExtension extends Extension {
	declare _settings: Gio.Settings | null;
	declare _area: St.DrawingArea | null;
	declare _indicator: PanelMenu.Button | null;
	declare _cameraMonitor: Shell.CameraMonitor | null;

	override enable() {
		const settings = (this._settings = this.getSettings());

		this._area = new St.DrawingArea({ reactive: false });
		this._area.connect('repaint', () => this._onRepaint());
		Main.layoutManager.addTopChrome(this._area, {
			trackFullscreen: false, // don't hide when an app is fullscreen
		});

		this._indicator = create_indicator(settings, () => this.openPreferences());
		Main.panel.addToStatusArea(this.uuid, this._indicator);

		this._cameraMonitor = new Shell.CameraMonitor();
		this._cameraMonitor.connect_object(
			'notify::cameras-in-use',
			() => this._updateEnabledForAutoMode(),
			this,
		);

		Main.layoutManager.connect_object('monitors-changed', () => this._resize(), this);

		settings.connect_object('changed', () => this._queueRepaint(), this);
		settings.connect_object('changed::auto-mode', () => this._updateEnabledForAutoMode(), this);

		this._resize();
		this._queueRepaint();
	}

	_updateEnabledForAutoMode() {
		if (!this._settings || !this._cameraMonitor) return;
		if (!this._settings.get_boolean('auto-mode')) return;

		const cameras_in_use = this._cameraMonitor.cameras_in_use;
		this._settings.set_boolean('enabled', cameras_in_use);
	}

	override disable() {
		this._cameraMonitor?.disconnect_object(this);
		this._cameraMonitor = null;

		Main.layoutManager.disconnect_object(this);

		this._settings?.disconnect_object(this);
		this._settings = null;

		this._indicator?.destroy();
		this._indicator = null;

		if (this._area) {
			Main.layoutManager.removeChrome(this._area);
			this._area.destroy();
			this._area = null;
		}
	}

	/**
	 * Sets {@link _area}'s position and size to match
	 * {@link Main.layoutManager.primaryMonitor}.
	 */
	_resize() {
		const monitor = Main.layoutManager.primaryMonitor;
		if (!monitor || !this._area) return;

		// Rendering time is O(n^2) in the long dimension,
		// so render no larger than RENDER_MAX pixels and let the GPU scale it up.
		const RENDER_MAX = 512;
		const sf = Math.min(1, RENDER_MAX / Math.max(monitor.width, monitor.height));
		const w = Math.max(2, Math.round(monitor.width * sf));
		const h = Math.max(2, Math.round(monitor.height * sf));

		this._area.set_position(monitor.x, monitor.y);
		this._area.set_size(w, h);
		this._area.set_scale(monitor.width / w, monitor.height / h);
		this._area.queue_repaint();
	}

	_queueRepaint() {
		if (!this._area || !this._settings) return;

		this._area.visible = this._settings.get_boolean('enabled');
		this._area.queue_repaint();
	}

	_onRepaint() {
		if (!this._area || !this._settings) return;

		const context = this._area.get_context();
		try {
			const [width, height] = this._area.get_surface_size();
			if (width < 1 || height < 1) return;

			drawGlow(context, width, height, {
				brightness: this._settings.get_double('brightness'),
				colorTemp: this._settings.get_double('color-temp'),
				// oxlint-disable-next-line typescript/no-unsafe-type-assertion
				glowSize: this._settings.get_string('glow-size') as keyof typeof GLOW_FRACTION,
			});
		} finally {
			context.$dispose();
		}
	}
}
