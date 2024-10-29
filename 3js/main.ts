import { URenderer } from "./renderer";

class WebXRApp {
  private session: XRSession | null;
  private gl: WebGLRenderingContext | null;
  private button: HTMLButtonElement | null;
  private xrRefSpace: XRReferenceSpace | null;

  constructor() {
    this.gl = null;
    this.button = null;
    this.session = null;
    this.xrRefSpace = null;
    this.init();
  }

  private async init(): Promise<void> {

    await this.checkWebXRSupport();

    const canvas = document.getElementById("xr-canvas") as HTMLCanvasElement | null;
    if (!canvas) {
      throw new Error("Canvas element not found");
    }
    const gl = canvas.getContext("webgl", { xrCompatible: true }) as WebGLRenderingContext | null;
    if (!gl) {
      throw new Error("Unable to initialize WebGL context");
    }
    this.gl = gl;

    const button = document.getElementById("enter-vr") as HTMLButtonElement;
    if (!button) {
      console.log("Could not find the VR button.");
      return;
    }
    this.button = button;
    button.style.display = "block"; // Show the VR button


    // Start VR session when the button is clicked
    button.addEventListener("click", () => this.createVRSession());

  }








  // Check if WebXR is supported
  private async checkWebXRSupport(): Promise<void> {
    if (navigator.xr && (await navigator.xr.isSessionSupported("immersive-vr"))) { }
    else {
      console.log("App:WebXR not supported on this device or browser.");
    }
  }

  // Start the VR session
  private async createVRSession() {
    console.log("XR session request...");
    try {
      this.session = await navigator.xr!.requestSession("immersive-vr") as XRSession;
      this.onSessionStarted(this.session);
    } catch (error) {
      console.error("Failed to start XR session:", error);
    }
  }


  // Initialize the XR session
  private async onSessionStarted(session: XRSession) {
    console.log("XR session started.");
    session.addEventListener("end", this.onSessionEnded);

    if (!this.gl) { return; }
    session.updateRenderState({ baseLayer: new XRWebGLLayer(session, this.gl) });

    this.xrRefSpace = await session.requestReferenceSpace("local") as XRReferenceSpace;

    // Start the rendering loop
    session.requestAnimationFrame((time, frame) => this.onXRFrame(time, frame));
  }


  // Handle the frame rendering
  private onXRFrame(t: DOMHighResTimeStamp, frame: XRFrame) {
    //console.log("XR time:", t);
    const session = frame.session;
    session.requestAnimationFrame((time, frame) => this.onXRFrame(time, frame));
    // Schedule the next frame, it's crucial to wrap in an arrow function to keep "this" context

    const gl = this.gl;
    if (!gl) { console.log("gl undefined"); return; }

    if (!this.xrRefSpace) { return; }
    const pose = frame.getViewerPose(this.xrRefSpace) as XRViewerPose;

    if (pose) {
      gl.clearColor(1.0, 1.0, 0.0, 1.0); // Clear screen with black
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      // Here, you'd typically render 3D content using WebGL and the pose data
      // Simple example:
      for (const view of pose.views) {
        const viewport = session.renderState.baseLayer!.getViewport(
          view
        ) as XRViewport;
        gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
      }
    }
  }


  // Handle the end of the session
  private onSessionEnded() {
    if (!this.button) { return; }
    this.button.style.display = "block"; // Show VR button again
    console.log("XR session ended.");
  }

}


const app = new WebXRApp();





