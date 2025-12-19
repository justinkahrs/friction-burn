export class Player {
  public x: number = 0; // Lateral position (-1 to 1 is road)
  public y: number = 0; // Vertical position (camera height)
  public z: number = 0; // Distance along track
  public speed: number = 0;
  
  public maxSpeed: number = 12000;
  public accel: number = 200; // acceleration rate
  public breaking: number = 500; // deceleration rate
  public decel: number = 100;    // passive deceleration
  public offRoadDecel: number = 300;
  
  public boostTimer: number = 0;

  constructor() {
    this.y = 1500; // Camera height off ground
  }
  
  public activateBoost() {
      this.boostTimer = 10; // 10 seconds
  }

  public update(dt: number, input: { up: boolean, down: boolean, left: boolean, right: boolean }, currentCurve: number) {
    // Speed control
    if (input.up) {
      this.speed += this.accel * (dt / (1000/60));
    } else if (input.down) {
      this.speed -= this.breaking * (dt / (1000/60));
    } else {
      this.speed -= this.decel * (dt / (1000/60));
    }


    // Clamp speed
    // Check for Boost
    let effectiveMaxSpeed = this.maxSpeed;
    if (this.boostTimer > 0) {
        this.boostTimer -= dt / 1000;
        effectiveMaxSpeed = this.maxSpeed * 1.2;
    }
    
    this.speed = Math.max(0, Math.min(this.speed, effectiveMaxSpeed));

    // Position update
    this.z += this.speed * (dt / 1000); 

    // Centrifugal Force
    // Drifts player in opposite direction of curve
    const centrifugal = (currentCurve * (this.speed / this.maxSpeed)) * 0.02; 
    this.x -= centrifugal;

    // Steering
    if (input.left) {
      this.x -= 0.06 * (this.speed / this.maxSpeed);
    } else if (input.right) {
      this.x += 0.06 * (this.speed / this.maxSpeed);
    }
    
    // Clamp X to bounds? Or let them go off road?
    // Let them go off road (-2 to 2)
    this.x = Math.max(-2, Math.min(2, this.x));
    
    // Slow down if off road
    if ((this.x < -1 || this.x > 1) && this.speed > this.maxSpeed / 4) {
        this.speed -= this.offRoadDecel * (dt / (1000/60));
    }
  }
}
