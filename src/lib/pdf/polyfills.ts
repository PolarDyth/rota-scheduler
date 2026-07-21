// pdfjs-dist/legacy/build/pdf.mjs references DOMMatrix at module-load time
// (`const SCALE_MATRIX = new DOMMatrix()`), and its own polyfill block only
// fills DOMMatrix/ImageData/Path2D from @napi-rs/canvas. In serverless runtimes
// that native package isn't installed, so the module crashes on import. We only
// do text extraction — no canvas rendering — so inert stubs are sufficient.

export {};

if (typeof globalThis.DOMMatrix === 'undefined') {
  class DOMMatrixStub {
    a = 1;
    b = 0;
    c = 0;
    d = 1;
    e = 0;
    f = 0;
    m11 = 1;
    m12 = 0;
    m13 = 0;
    m14 = 0;
    m21 = 0;
    m22 = 1;
    m23 = 0;
    m24 = 0;
    m31 = 0;
    m32 = 0;
    m33 = 1;
    m34 = 0;
    m41 = 0;
    m42 = 0;
    m43 = 0;
    m44 = 1;
    constructor() {}
    multiply() {
      return this;
    }
    multiplySelf() {
      return this;
    }
    preMultiplySelf() {
      return this;
    }
    translate() {
      return this;
    }
    translateSelf() {
      return this;
    }
    scale() {
      return this;
    }
    scaleSelf() {
      return this;
    }
    rotate() {
      return this;
    }
    rotateSelf() {
      return this;
    }
    invert() {
      return this;
    }
    invertSelf() {
      return this;
    }
    setMatrix() {
      return this;
    }
    transformPoint() {
      return { x: 0, y: 0, z: 0, w: 1 };
    }
    toFloat32Array() {
      return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    }
    toFloat64Array() {
      return new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    }
    toString() {
      return 'matrix(1, 0, 0, 1, 0, 0)';
    }
  }
  (globalThis as { DOMMatrix?: unknown }).DOMMatrix = DOMMatrixStub;
}

if (typeof globalThis.Path2D === 'undefined') {
  class Path2DStub {
    constructor() {}
    addPath() {}
    moveTo() {}
    lineTo() {}
    closePath() {}
    bezierCurveTo() {}
    quadraticCurveTo() {}
    arc() {}
    arcTo() {}
    ellipse() {}
    rect() {}
  }
  (globalThis as { Path2D?: unknown }).Path2D = Path2DStub;
}

if (typeof globalThis.ImageData === 'undefined') {
  class ImageDataStub {
    data: Uint8ClampedArray;
    width: number;
    height: number;
    constructor(widthOrData: number | Uint8ClampedArray, heightOrWidth?: number) {
      if (typeof widthOrData === 'number') {
        this.width = widthOrData;
        this.height = heightOrWidth ?? 1;
        this.data = new Uint8ClampedArray(this.width * this.height * 4);
      } else {
        this.data = widthOrData;
        this.width = heightOrWidth ?? 1;
        this.height = Math.max(1, this.data.length / 4 / this.width);
      }
    }
  }
  (globalThis as { ImageData?: unknown }).ImageData = ImageDataStub;
}
