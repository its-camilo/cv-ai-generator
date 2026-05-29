import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-glare-hover',
  template: `<div class="glare-hover" [style]="hostStyles"><ng-content /></div>`,
  styleUrl: './glare-hover.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GlareHover {
  readonly width = input('auto');
  readonly height = input('auto');
  readonly background = input('transparent');
  readonly borderRadius = input('0');
  readonly borderColor = input('transparent');
  readonly glareColor = input('#f5e6c8');
  readonly glareOpacity = input(0.55);
  readonly glareAngle = input(-35);
  readonly glareSize = input(280);
  readonly transitionDuration = input(700);

  get hostStyles(): Record<string, string> {
    const hex = this.glareColor().replace('#', '');
    let rgba = this.glareColor();

    if (/^[0-9A-Fa-f]{6}$/.test(hex)) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      rgba = `rgba(${r}, ${g}, ${b}, ${this.glareOpacity()})`;
    }

    return {
      '--gh-width': this.width(),
      '--gh-height': this.height(),
      '--gh-bg': this.background(),
      '--gh-br': this.borderRadius(),
      '--gh-border': this.borderColor(),
      '--gh-angle': `${this.glareAngle()}deg`,
      '--gh-duration': `${this.transitionDuration()}ms`,
      '--gh-size': `${this.glareSize()}%`,
      '--gh-rgba': rgba,
    };
  }
}
