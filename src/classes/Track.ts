import { Segment } from './RoadRenderer';

export class Track {
  public segments: Segment[] = [];
  public segmentLength: number = 200; // Size of a segment in Z space
  public roadWidth: number = 2200;    // Width of the road
  public totalLength: number = 0;

  constructor() {
    this.generateTrack();
  }
  
  public addSprite(index: number, type: string, speed: number, x: number) {
      if (index < 0 || index >= this.segments.length) return;
      
      this.segments[index].sprites.push({
          x: x,
          y: 0,
          z: this.segments[index].p1.z, // Use segment Z
          type: type,
          speed: speed,
          width: 400,
          height: 400,
          scale: 1
      });
  }

  public generateTrack() {
    this.segments = [];
    this.totalLength = 0;
    
    // Start Line
    this.createStraight(20); 

    // Procedural Sections
    const targetSections = 40; 
    
    for (let i = 0; i < targetSections; i++) {
        const r = Math.random();
        
        // Add random obstacles in this section
        // 50% chance to have obstacles
        const hasObstacles = Math.random() < 0.5;
        
        let sectionLength = 0;

        if (r < 0.2) {
            // Straight
            sectionLength = Math.floor(20 + Math.random() * 40);
            this.createStraight(sectionLength);
        } else if (r < 0.4) {
            // Simple Curve
            const dir = Math.random() < 0.5 ? -1 : 1;
            const strength = 1 + Math.random() * 3;
            sectionLength = Math.floor(30 + Math.random() * 30);
            this.createCurve(sectionLength, dir * strength, 0); 
        } else if (r < 0.6) {
            // Simple Hill
            const height = (Math.random() * 3000) - 1500; 
            sectionLength = Math.floor(40 + Math.random() * 40);
            this.createHill(sectionLength, height);
        } else if (r < 0.8) {
             // Curve + Hill
             const dir = Math.random() < 0.5 ? -1 : 1;
             const strength = 1 + Math.random() * 3;
             const height = (Math.random() * 3000) - 1500;
             sectionLength = Math.floor(40 + Math.random() * 40);
             this.createCurve(sectionLength, dir * strength, height);
        } else {
             // S-Curve
             const strength = 1 + Math.random() * 3;
             this.createCurve(30, strength, 0);
             this.createStraight(10);
             this.createCurve(30, -strength, 0);
             sectionLength = 70;
        }

        if (hasObstacles) {
            // Place 1-3 obstacles spread out in this section
            // Relative to current end of track: this.segments.length - 1
            const startIdx = this.segments.length - sectionLength;
            const count = Math.floor(1 + Math.random() * 2);
            
            for(let k=0; k<count; k++) {
                const globalIdx = Math.floor(startIdx + (Math.random() * sectionLength));
                const lane = Math.random() < 0.5 ? -0.5 : 0.5; // Left or Right lane
                const isPowerup = Math.random() < 0.1; // 10% chance for powerup
                const isStatic = Math.random() < 0.3;
                
                let type = 'red_square';
                let obsSpeed = 0;
                
                if (isPowerup) {
                    type = 'boost_powerup';
                    obsSpeed = 0; // Powerups are stationary
                } else if (!isStatic) {
                    if (lane > 0) {
                        // Right Side: Same direction, 80% rider speed
                        obsSpeed = 2000 * 0.8;
                    } else {
                        // Left Side: Opposite direction, 120% rider speed (negative Z)
                        obsSpeed = -(12000 * 1.2); 
                    }
                }
                
                this.addSprite(globalIdx, type, obsSpeed, lane);
            }
        }
    }

    // Finish Line area
    this.createStraight(50);
  }

  public getSegment(z: number): Segment {
    if (this.segments.length === 0) return { 
        index: 0, 
        p1: { x: 0, y: 0, z: 0 }, 
        p2: { x: 0, y: 0, z: 0 }, 
        curve: 0, 
        sprites: [],
        color: { road: 0, grass: 0, rumble: 0 } 
    };
    const index = Math.floor(z / this.segmentLength);
    const correctedIndex = ((index % this.segments.length) + this.segments.length) % this.segments.length;
    return this.segments[correctedIndex];
  }

  public createStraight(length: number) {
    this.addRoad(length, length, length, 0, 0);
  }

  public createCurve(length: number, curve: number, y: number) {
      this.addRoad(length, length, length, curve, y);
  }

  public createHill(length: number, y: number) {
      this.addRoad(length, length, length, 0, y);
  }

  private addRoad(enter: number, hold: number, leave: number, curve: number, y: number) {
    const startY = this.segments.length === 0 ? 0 : this.segments[this.segments.length - 1].p2.y;
    const numSegments = enter; // Simplified for now
    
    for (let i = 0; i < numSegments; i++) {
        const segmentY = startY + (y * Math.sin((i / numSegments) * Math.PI));
        this.addSegment(curve, segmentY); 
    }
  }

  private addSegment(curve: number, y: number) {
    const index = this.segments.length;
    
    // alternating colors
    const dark = Math.floor(index / 3) % 2; 
    const color = dark ? {
      road: 0x6B6B6B,
      grass: 0x10AA10,
      rumble: 0x555555
    } : {
      road: 0x696969,
      grass: 0x009A00,
      rumble: 0xBBBBBB
    };

    const p1 = { 
        x: 0, 
        y: this.segments.length === 0 ? 0 : this.segments[this.segments.length-1].p2.y, 
        z: index * this.segmentLength 
    };
    
    const p2y = y;

    this.segments.push({
      index: index,
      p1: p1,
      p2: { x: 0, y: p2y, z: (index + 1) * this.segmentLength },
      curve: curve,
      sprites: [],
      color: color
    });
    
    this.totalLength = this.segments.length * this.segmentLength;
  }
}
