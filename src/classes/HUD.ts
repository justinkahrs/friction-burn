import Phaser from 'phaser';

export class HUD {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private graphics: Phaser.GameObjects.Graphics;
  
  public mirrorGraphics: Phaser.GameObjects.Graphics; // Exposed for RoadRenderer
  
  private speedText: Phaser.GameObjects.Text;
  private odoText: Phaser.GameObjects.Text;
  
  public leftMirror: Phaser.Geom.Rectangle;
  public rightMirror: Phaser.Geom.Rectangle;
  
  private powerupIcon: Phaser.GameObjects.Rectangle;
  private powerupText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, scene.scale.height - 200);
    this.container.setDepth(1000); // Top layer
    
    // 1. Dashboard Background
    const bg = scene.add.rectangle(scene.scale.width/2, 100, scene.scale.width, 200, 0x222222);
    const border = scene.add.rectangle(scene.scale.width/2, 0, scene.scale.width, 5, 0x555555);
    this.container.add(bg);
    this.container.add(border);

    // 2. Mirror Graphics Layer (Draw road here)
    this.mirrorGraphics = scene.add.graphics();
    this.container.add(this.mirrorGraphics);
    
    // Create Mask for Mirrors
    const maskShape = scene.make.graphics({});
    maskShape.fillStyle(0xFFFFFF);
    
    // Left Mirror Mask Rect (Absolute rendering coordinates?)
    // Masking in Phaser 3 works in Global World Space usually.
    // Our mirroring graphics is inside a Container.
    // Container is at (0, scale.height-200).
    // Mirror Rects in HUD are defined as Absolute or Relative? 
    // In HUD.ts constructor:
    // this.leftMirror = new Phaser.Geom.Rectangle(20, 20, 200, 100); -> intended relative to container?
    // But in GameScene we pass them to renderRear, which uses them for Viewport.
    // If renderRear uses them to determine 'c.y', and 'c.y' is used for rendering...
    // The previously updated RoadRenderer uses `viewport.y + height * 0.25`.
    // If we passed Relative coords (20, 20) to renderRear, it draws at y=20.
    // But since it's in a Container at Y=Height-200, drawing at y=20 lands at Height-180.
    // That seems correct.
    
    // So Mask must also be at Relative coords (20, 20) inside the container?
    // No, GeometryMask source graphics usually need to be in World Space if the target is in World Space?
    // Or if applied to a Container child, does it respect container transform?
    // GeometryMask logic is tricky.
    
    // Let's assume Mask graphics coordinates match the target's world coordinates space?
    // Actually, safest is to draw the Mask Shape at the Screen Coordinates where the mirrors are.
    // Mirror Left Screen: X=20, Y=Height-180.
    // Mirror Right Screen: X=Width-220, Y=Height-180.
    
    maskShape.fillRect(20, scene.scale.height - 180, 200, 100);
    maskShape.fillRect(scene.scale.width - 220, scene.scale.height - 180, 200, 100);
    
    const mask = maskShape.createGeometryMask();
    this.mirrorGraphics.setMask(mask);
    
    // 3. Mirror Frames (Borders only, Transparent/Hollow centers)
    // Left Mirror
    // We used new Phaser.Geom.Rectangle(20, 20, 200, 100) at the end of constructor for 'public' properties.
    // But we need to make sure GameScene passes the correct Relative coordinates to renderRear 
    // so that renderRear draws into the Container at the right place.
    
    // Currently public vars set at bottom of constructor:
    // this.leftMirror = new Phaser.Geom.Rectangle(20, 20, 200, 100);
    // this.rightMirror = new Phaser.Geom.Rectangle(scene.scale.width - 220, 20, 200, 100);
    // These are RELATIVE to the container (0, Height-200).
    // So Drawing at y=20 puts it at Height-180 on screen.
    // Mask matches this (Height-180).
    
    // Frames
    const lMirrorFrame = scene.add.rectangle(120, 70, 200, 100); 
    lMirrorFrame.setStrokeStyle(4, 0x888888);
    this.container.add(lMirrorFrame);
    
    const rMirrorFrame = scene.add.rectangle(scene.scale.width - 120, 70, 200, 100);
    rMirrorFrame.setStrokeStyle(4, 0x888888);
    this.container.add(rMirrorFrame);
    
    // 4. Gauges (On top)
    this.graphics = scene.add.graphics();
    this.container.add(this.graphics);

    // Speed
    this.speedText = scene.add.text(scene.scale.width/2, 50, '0', {
        fontFamily: 'monospace',
        fontSize: '48px',
        color: '#00FF00',
        align: 'center'
    }).setOrigin(0.5);
    this.container.add(this.speedText);
    
    const label = scene.add.text(scene.scale.width/2, 90, 'KM/H', {
        fontFamily: 'monospace', 
        fontSize: '16px',
        color: '#888888'
    }).setOrigin(0.5);
    this.container.add(label);
    
    // Odometer
    this.odoText = scene.add.text(scene.scale.width/2, 140, '000000', {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#FFFFFF'
    }).setOrigin(0.5);
    this.container.add(this.odoText);
    
    // Powerup Icon (Hidden by default)
    this.powerupIcon = scene.add.rectangle(scene.scale.width/2, 180, 40, 40, 0xFFFF00);
    this.powerupIcon.setVisible(false);
    this.container.add(this.powerupIcon);
    
    this.powerupText = scene.add.text(scene.scale.width/2, 180, 'READY', {
        fontFamily: 'monospace', fontSize: '12px', color: '#000000'
    }).setOrigin(0.5).setVisible(false);
    this.container.add(this.powerupText);
    
    // Fix public rects to be absolute for Viewport usage if needed, 
    // OR we just use them for Reference.
    // ProjectRear needs viewport.
    // If drawing into Container-attached Graphics, coordinates are RELATIVE to Container.
    // So viewport passed to renderRear should be Relative.
    
    this.leftMirror = new Phaser.Geom.Rectangle(20, 20, 200, 100);
    this.rightMirror = new Phaser.Geom.Rectangle(scene.scale.width - 220, 20, 200, 100);
  }

  public update(speed: number, maxSpeed: number, distance: number, hasPowerup: boolean, isBoosting: boolean) {
    this.speedText.setText(Math.floor(speed / 100).toString());
    this.odoText.setText(Math.floor(distance / 1000).toString().padStart(6, '0'));
    
    // Powerup UI
    if (isBoosting) {
        // Blinking effect? Or just show "BOOST"
        this.powerupIcon.setVisible(true);
        this.powerupIcon.setFillStyle(0x00FFFF); // Cyan for active boost
        this.powerupText.setText("BOOST!");
        this.powerupText.setVisible(true);
    } else if (hasPowerup) {
        this.powerupIcon.setVisible(true);
        this.powerupIcon.setFillStyle(0xFFFF00); // Yellow for ready
        this.powerupText.setText("READY");
        this.powerupText.setVisible(true);
    } else {
        this.powerupIcon.setVisible(false);
        this.powerupText.setVisible(false);
    }
    
    // Update RPM
    this.graphics.clear();
    const ratio = Math.min(1, speed / maxSpeed);
    
    // RPM Bar
    const barW = 300;
    const barH = 20;
    const barX = (this.scene.scale.width - barW) / 2;
    
    this.graphics.fillStyle(0x000000);
    this.graphics.fillRect(barX, 110, barW, barH);
    
    const color = ratio > 0.8 ? 0xFF0000 : (ratio > 0.5 ? 0xFFFF00 : 0x00FF00);
    this.graphics.fillStyle(color);
    this.graphics.fillRect(barX, 110, barW * ratio, barH);
  }
}
