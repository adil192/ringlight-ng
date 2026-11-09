import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import St from 'gi://St';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { Slider } from 'resource:///org/gnome/shell/ui/slider.js';

import { CameraWatcher } from './camera.js';
import { drawGlow } from './glow.js';
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
	declare _cameraWatcher: CameraWatcher | null;

	declare _settingsChangedId: number | null;
	declare _settingsAutoModeChangedId: number | null;
	declare _monitorsChangedId: number | null;

	override enable() {
		const settings = this._settings = this.getSettings();

		this._area = new St.DrawingArea({ reactive: false });
		this._area.connect('repaint', () => this._repaint());
		// TODO: Move to `Main.uiGroup.add_child`?
		Main.layoutManager.addTopChrome(this._area, {
			affectsInputRegion: false,
			affectsStruts: false,
			trackFullscreen: false, // a video call in fullscreen still wants light
		});

		this._indicator = new RinglightIndicator(settings, () => this.openPreferences());
		Main.panel.addToStatusArea(this.uuid, this._indicator);

		this._cameraWatcher = new CameraWatcher(active => {
			if (settings.get_boolean('auto-mode')) settings.set_boolean('enabled', active);
		});
		if (settings.get_boolean('auto-mode')) this._cameraWatcher.start();

		this._settingsChangedId = settings.connect('changed', () => this._apply());

		this._settingsAutoModeChangedId = settings.connect('changed::auto-mode', () => {
			if (this._cameraWatcher) {
				if (settings.get_boolean('auto-mode')) {
					this._cameraWatcher.start();
					settings.set_boolean('enabled', this._cameraWatcher.active);
				} else {
					this._cameraWatcher.stop();
				}
			}
		});

		this._monitorsId = Main.layoutManager.connect('monitors-changed', () => this._resize());

		this._resize();
		this._apply();
	}

	disable() {
		// Signals first: their handlers reach for the camera watcher and the
		// actor, both of which are about to stop existing.
		if (this._settingsId) this._settings.disconnect(this._settingsId);
		if (this._autoId) this._settings.disconnect(this._autoId);
		this._settingsId = 0;
		this._autoId = 0;

		if (this._monitorsId) Main.layoutManager.disconnect(this._monitorsId);
		this._monitorsId = 0;

		this._cameraWatcher?.destroy();
		this._cameraWatcher = null;

		this._indicator?.destroy();
		this._indicator = null;

		if (this._area) {
			this._area.disconnect(this._repaintId);
			Main.layoutManager.removeChrome(this._area);
			this._area.destroy();
			this._area = null;
		}

		this._settings = null;
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
		this._area.visible = this._settings.get_boolean('enabled');
		this._area.queue_repaint();
	}

	// Only ever runs on a settings change, a monitor change, or the first show.
	// Nothing in the glow follows the pointer or a clock, so there is no
	// repaint to schedule and no timer to leave running.
	_repaint() {
		const cr = this._area.get_context();
		const [width, height] = this._area.get_surface_size();
		try {
			if (width < 1 || height < 1) return;
			drawGlow(cr, width, height, {
				brightness: this._settings.get_double('brightness'),
				colorTemp: this._settings.get_double('color-temp'),
				glowSize: this._settings.get_string('glow-size'),
			});
		} finally {
			cr.$dispose();
		}
	}
}
