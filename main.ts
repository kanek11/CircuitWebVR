import { URenderer } from "./renderer";

// WebXR's requestReferenceSpace only works if the corresponding feature
// was requested at session creation time. For simplicity, just ask for
// the interesting ones as optional features, but be aware that the
// requestReferenceSpace call will fail if it turns out to be unavailable.
// ('local' is always available for immersive sessions and doesn't need to
// be requested separately.)



class WebXRApp {
  private session: XRSession | null = null;
  private gl: WebGLRenderingContext | null = null;
  private button: HTMLButtonElement | null = null;
  private xrRefSpace: XRReferenceSpace | null = null;


  private sessionInit: XRSessionInit = {
    'optionalFeatures': ['depth-sensing'],
    'depthSensing': {
      'usagePreference': ['gpu-optimized'],
      'dataFormatPreference': []
    }
  };

  private xrRenderer: URenderer | null = null;

  constructor() {
    this.xrRenderer = new URenderer();
    this.initXRSession();
  }

  private async initXRSession(): Promise<void> {

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
    button.addEventListener("click", () => this.onButtonClick());
    window.addEventListener("keydown", (event) => this.onKeyDown(event));

  }

  private onKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape" && this.session) {
      this.onSessionEnded();
    }
  }


  // Check if WebXR is supported
  private async checkWebXRSupport(): Promise<void> {
    if (navigator.xr && (await navigator.xr.isSessionSupported("immersive-vr"))) { }
    else {
      console.log("App:WebXR not supported on this device or browser.");
    }
  }

  // Start the VR session
  private async onButtonClick() {
    console.log("request XR session ...");

    const sessionOptions = {
      ...this.sessionInit,
      optionalFeatures: [
        'local-floor',
        'bounded-floor',
        'layers',
        ...(this.sessionInit.optionalFeatures || [])
      ],
    };

    //enter VR
    navigator.xr!.requestSession('immersive-vr', sessionOptions).then((session) => {
      this.onSessionStarted(session);
    });

  }


  private async onSessionStarted(session: XRSession): Promise<void> {

    await this.xrRenderer!.renderer.xr.setSession(session);
    this.session = session;
    //this.xrRenderer!.startRender(this.session);

    console.log("XR session started.");
  }


  // Handle the end of the session
  private async onSessionEnded(): Promise<void> {
    if (!this.button) { return; }

    await this.session!.end().then(() => {
      //todo: clean up   
      this.button!.textContent = 'RE-ENTER VR';
      this.session = null;
    }
    ).catch((error) => {
      console.error("Failed to end XR session:", error);
    });

    console.log("XR session ended.");
    this.button.style.display = "block"; // Show VR button again
  }

}


const app = new WebXRApp();





