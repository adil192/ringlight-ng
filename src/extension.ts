import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

import Gio from 'gi://Gio';
import Shell from 'gi://Shell';
import St from 'gi://St';

import { drawGlow, GLOW_FRACTION } from './glow.js';
import { RinglightIndicator } from './indicator.js';

// The glow is painted onto a surface this many pixels on its long side and the
// actor is scaled up to fill the monitor. Cairo is a software rasteriser and
// this runs inside the compositor: a full 2560x1600 repaint measures 67ms, four
// frame budgets. At 512 it is under a millisecond, and the scale-up costs at
// most 0.016 of alpha against a full-size render, because every gradient here
// is far smoother than the pixel grid.
const RENDER_MAX = 512;

export default class RinglightExtension extends Extension {
	declare _settings: Gio.Settings | null;
	declare _area: St.DrawingArea | null;
	declare _indicator: typeof RinglightIndicator.prototype | null;
	declare _cameraMonitor: Shell.CameraMonitor | null;

	override enable() {
		const settings = this._settings = this.getSettings();

		this._area = new St.DrawingArea({ reactive: false });
		this._area.connect('repaint', () => this._repaint());
		// TODO: Move to `Main.uiGroup.add_child`? https://gitlab.gnome.org/GNOME/gnome-shell/-/commit/e62d22a50ed8aa25de988fb3c389b999e42f2eac
		Main.layoutManager.addTopChrome(this._area, {
			affectsInputRegion: false,
			affectsStruts: false,
			trackFullscreen: false, // a video call in fullscreen still wants light
		});

		this._indicator = new RinglightIndicator(settings, () => this.openPreferences());
		Main.panel.addToStatusArea(this.uuid, this._indicator);

		this._cameraMonitor = new Shell.CameraMonitor();
		this._cameraMonitor.connect_object('notify::cameras-in-use', () => this._updateEnabledForAutoMode(), this);

		Main.layoutManager.connect_object('monitors-changed', () => this._resize(), this);

		settings.connect_object('changed', () => this._apply(), this);
		settings.connect_object('changed::auto-mode', () => this._updateEnabledForAutoMode(), this);

		this._resize();
		this._apply();
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

	// ponytail: primary monitor only. A ring light is for the screen your face
	// is pointed at; add a per-monitor actor list if someone actually asks.
	_resize() {
		const monitor = Main.layoutManager.primaryMonitor;
		if (!monitor || !this._area) return;

		// Paint small, let the GPU stretch it. See RENDER_MAX.
		const k = Math.min(1, RENDER_MAX / Math.max(monitor.width, monitor.height));
		const w = Math.max(2, Math.round(monitor.width * k));
		const h = Math.max(2, Math.round(monitor.height * k));

		this._area.set_position(monitor.x, monitor.y);
		this._area.set_size(w, h);
		this._area.set_scale(monitor.width / w, monitor.height / h);
		this._area.queue_repaint();
	}

	_apply() {
		if (!this._area || !this._settings) return;

		this._area.visible = this._settings.get_boolean('enabled');
		this._area.queue_repaint();
	}

	// Only ever runs on a settings change, a monitor change, or the first show.
	// Nothing in the glow follows the pointer or a clock, so there is no
	// repaint to schedule and no timer to leave running.
	_repaint() {
		if (!this._area || !this._settings) return;

		const context = this._area.get_context();
		const [width, height] = this._area.get_surface_size();
		try {
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
