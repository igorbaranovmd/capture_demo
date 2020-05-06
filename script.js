document.addEventListener('DOMContentLoaded', main);

function main() {

  const captureVideoButton = document.querySelector('#test .capture-button');
  const startWithUpload = document.querySelector('#test .start-with-upload');
  const buttonsContainer = document.querySelector('#buttons');
  const fileInput = document.querySelector('#file-input');
  const video = document.querySelector('#test video');
  const testContainer = document.querySelector('#test');
  const modal = document.querySelector('#modal');

  const modalBootstrapped = M.Modal.init(modal, {
    dismissible: false
  });

  modalBootstrapped.open();
  let modelsLoaded = false;

  const path = location.hostname === 'localhost' ? '/models' : '/capture_demo/models'
  Promise.all([
    faceapi.nets.faceExpressionNet.loadFromUri(path),
    faceapi.nets.tinyFaceDetector.loadFromUri(path)
  ])
    .then(() => {
      // avoid lag on first detect on real img/video
      return new Promise(res => {
        const image = new Image();
        image.src = location.hostname === 'localhost' ? '/fake_image.jpg' : '/capture_demo/fake_image.jpg';
        image.onload = () =>
          faceapi.detectSingleFace(image, new faceapi.TinyFaceDetectorOptions()).withFaceExpressions().run().then(res, res);
        image.onerror = res;
        image.onabort = res;
      })
    }) // first run for lags avoid
    .then(() => {
      modalBootstrapped.close();
      modelsLoaded = true;
      testContainer.style.display = 'block';
    }).catch((e) => {
      modalBootstrapped.close();
      alert('something went wrong');
    });


  startWithUpload.onclick = function () {
    fileInput.click();
  }

  fileInput.addEventListener('change', e => {
    const target = e.target;
    if (target.files.length) {
      buttonsContainer.style.display = 'none';
      if (URL && URL.createObjectURL) {
        init(null, null, null, URL.createObjectURL(target.files[0]));
      } else {
        const reader = new FileReader();
        reader.onerror = function () {
          buttonsContainer.style.display = 'block';

          alert('something went wrong');
        };
        reader.onload = function (file) {
          const result = file.target.result;
          init(null, null, null, result);
        }
        reader.readAsDataURL(target.files[0]);
      }

    }
  });
  captureVideoButton.onclick = function () {
    buttonsContainer.style.display = 'none';
    navigator.mediaDevices.getUserMedia({
      video: true
    }).then(stream => {
      const tracks = stream.getTracks();
      if (!tracks.length) throw new Error('pew');
      init(null, null, stream);
    }).catch((e) => {
      alert('something went wrong')
    });
  };

  function init(width, height, stream, videoSrc) {
    if (stream) {
      video.srcObject = stream;
    } else {
      video.src = videoSrc;
    }
    video.addEventListener('loadeddata', () => {
      video.play();
      startLogic(width, height);
    });
  }


  function startLogic(width, height) {
    if (!width || !height) {
      video.style.display = 'block';
      const videoRect = video.getBoundingClientRect();
      const vRatio = video.videoWidth / video.videoHeight;
      width = videoRect.width;
      height = width / vRatio;
    }
    video.style.display = 'none';

    const canvas = document.querySelector('#canvas');
    canvas.setAttribute('width', width);
    canvas.setAttribute('height', height);
    video.setAttribute('width', width);
    video.setAttribute('height', height);

    video.style.width = width + 'px';
    video.style.height = height + 'px';
    // video.style.position = 'absolute';
    // video.style.left = '-9999px';

    video.setAttribute('autoplay', '');
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    const fabricCanvas = new fabric.Canvas(canvas, {
      width,
      height
    });

    const zones = document.querySelector('#zones');

    zones.addEventListener('click', (e) => {
      if (e.target.classList.contains('remove')) {
        e.preventDefault();
        if (e.target.parentNode._rect) {
          const _rect = e.target.parentNode._rect;
          fabricCanvas.remove(_rect);
          rects.splice(rects.indexOf(_rect), 1);
          e.target.parentNode.remove();
        }
      } else if (e.target.classList.contains('remove-icon')) {
        e.preventDefault();
        if (e.target.parentNode.parentNode._rect) {
          const _rect = e.target.parentNode.parentNode._rect;
          fabricCanvas.remove(_rect);
          rects.splice(rects.indexOf(_rect), 1);
          e.target.parentNode.parentNode.remove();
        }
      }
    })

    let initialPos, bounds, rect, dragging = false, isMoving = false;
    const options = {
      drawRect: false,
      onlyOne: false,
      rectProps: {
        stroke: 'red',
        strokeWidth: 1,
        fill: '',
        hasRotatingPoint: false,
        lockUniScaling: true
      }
    }

    window.rects = [];

    function onMouseDown(e) {
      dragging = true;
      initialPos = {...e.pointer}
      bounds = {}
      if (isMoving) {
        isMoving = false;
        return;
      }
      if (options.drawRect && !isMoving) {
        rect = new fabric.Rect({
          left: initialPos.x,
          top: initialPos.y,
          width: 0, height: 0,
          ...options.rectProps
        });
        fabricCanvas.add(rect)
        rects.push(rect);
      }
    }

    function update({pointer}) {
      if (initialPos.x > pointer.x) {
        bounds.x = Math.max(0, pointer.x)
        bounds.width = initialPos.x - bounds.x
      } else {
        bounds.x = initialPos.x
        bounds.width = pointer.x - initialPos.x
      }
      if (initialPos.y > pointer.y) {
        bounds.y = Math.max(0, pointer.y)
        bounds.height = initialPos.y - bounds.y
      } else {
        bounds.height = pointer.y - initialPos.y
        bounds.y = initialPos.y
      }

      if (options.drawRect && !isMoving) {
        rect.left = bounds.x
        rect.top = bounds.y
        rect.width = bounds.width
        rect.height = bounds.height
        rect.dirty = true
        fabricCanvas.requestRenderAllBound()
      }
    }

    function onMouseMove(e) {
      if (!dragging && !isMoving) return;
      requestAnimationFrame(() => update(e))
    }

    function onMouseUp(e) {
      dragging = false;
      if (options.drawRect && rect && (rect.width == 0 || rect.height === 0)) {
        fabricCanvas.remove(rect)
      }
      if ((!options.drawRect || !rect) && !isMoving) {
        rect = new fabric.Rect({
          ...bounds, left: bounds.x, top: bounds.y,
          ...options.rectProps
        });
        fabricCanvas.add(rect)
        rects.push(rect);
        rect.dirty = true
        fabricCanvas.requestRenderAllBound()
      }
      isMoving = false;
      rect.setCoords()
    }

    function preventResizeOut() {
      const currentRect = this.getActiveObject();
      if (currentRect instanceof fabric.Rect) {
        if (currentRect.top < 0) {
          currentRect.top = 0;
        }
        if (currentRect.left < 0) {
          currentRect.left = 0;
        }

        if ((currentRect.left + currentRect.width * currentRect.scaleX) > width) {
          currentRect.left = width - currentRect.width * currentRect.scaleX;
        }

        if ((currentRect.top + currentRect.height * currentRect.scaleY) > height) {
          currentRect.top = height - currentRect.height * currentRect.scaleY;
        }
        currentRect.setCoords();
      }
    };

    function install() {
      fabricCanvas.on('mouse:down', onMouseDown);
      fabricCanvas.on('object:moving', function() {
        preventResizeOut.call(this);
        isMoving = true;
      });
      fabricCanvas.on('object:scaling', function() {
        preventResizeOut.call(this);
        isMoving = true;
      });
      fabricCanvas.on('object:rotating', function() {
        preventResizeOut.call(this);
        isMoving = true;
      });
      fabricCanvas.on('object:skewing', function() {
        preventResizeOut.call(this);
        isMoving = true;
      });
      fabricCanvas.on('mouse:move', onMouseMove);
      fabricCanvas.on('mouse:up', onMouseUp);

      fabricCanvas.on('after:render', function () {
        this.calcOffset();
      });
    }

    install();

    fabric.customBackground = fabric.util.createClass(fabric.Object, {
      render(ctx) {
        ctx.drawImage(video, 0, 0, width, height);
      }
    });

    fabricCanvas.add(new fabric.customBackground());

    const emotionsMap = {
      happy: {
        emoji: 0x1F603,
        value: 0
      },
      angry: {
        emoji: 0x1F620,
        value: 0
      },
      fearful: {
        emoji: 0x1F628,
        value: 0
      },
      sad: {
        emoji: 0x1F615,
        value: 0
      },
      suprised: {
        emoji: 0x1F62E,
        value: 0
      }
    };

    Object.keys(emotionsMap).reverse().forEach((key, index) => {
      emotionsMap[key].text = new fabric.Text(String.fromCodePoint(emotionsMap[key].emoji), {
        fill: 'black',
        top: height - 40,
        fontSize: 30,
        left: width - (index === 0 ? 30 : (index * 40) + 30) - 15
      });

      emotionsMap[key].rect = new fabric.Rect({
        fill: 'blue',
        top: height - 40 - 35 - 20 + 49,
        width: 30,
        height: 0,
        left: width - (index === 0 ? 30 : (index * 40) + 30) - 15
      })

      fabricCanvas.add(emotionsMap[key].text);
      fabricCanvas.add(emotionsMap[key].rect);
    });

    const emotionsData = [];

    const interval = setInterval(() => {
      if (modelsLoaded) {
        fabric.util.requestAnimFrame(async function detect() {
          try {
            const res = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions()).withFaceExpressions();
            if (res) {
              emotionsData.push(res);
            }
          } catch (e) {

          } finally {
            setTimeout(() => {
              fabric.util.requestAnimFrame(detect)
            }, 100);
          }
        });
        clearInterval(interval);
      }
    }, 1000)

    setInterval(() => {
      if (emotionsData.length) {
        const total = emotionsData.reduce((prev, { expressions }) => {
          if (Object.keys(prev).length) {
            Object.keys(expressions).forEach(key => {
              prev[key] += expressions[key]
            });
            return prev;
          }
          return expressions;
        }, {});
        Object.keys(total).forEach(key => {
          total[key] = total[key] / emotionsData.length;
        });
        Object.keys(emotionsMap).forEach(emotion => {
          const i = emotionsMap[emotion]
          const r = i.rect;
          i.value = total[emotion] > 1 ? 1 : total[emotion];
          r.set('height', 50 * i.value);
          r.set('top', height - 40 - 35 - 20 + (50 - 50 * i.value));
          r.setCoords();
        });
        emotionsData.length = 0;
      }
    }, 5000);

    fabric.util.requestAnimFrame(function render() {
      rects.forEach(r => {
        let canv;
        let append;
        const find = [...zones.querySelectorAll('.canvas')].find(c => c._rect === r);
        if (find) {
          append = find;
          canv = find.querySelector('canvas');
        } else {
          append = document.createElement('div');
          const remove = document.createElement('div');
          remove.innerHTML = '<i class="material-icons remove-icon">delete</i>';
          remove.setAttribute('class', 'remove btn-floating btn-large waves-effect waves-light red');
          append.appendChild(remove);
          append.classList.add('canvas');
          append.classList.add('js-resizable');
          append._rect = r;
          canv = document.createElement('canvas');
          append.appendChild(canv);
          interact(append).resizable({
            edges: {left: true, right: true, bottom: true, top: true},
            modifiers: [interact.modifiers.aspectRatio({
              ratio: 'preserve'
            })],
            listeners: {
              move(event) {
                const target = event.target
                let x = (parseFloat(target.getAttribute('data-x')) || 0)
                let y = (parseFloat(target.getAttribute('data-y')) || 0)

                // update the element's style
                target.style.width = event.rect.width + 'px'
                target.style.height = event.rect.height + 'px'

                // translate when resizing from top or left edges
                x += event.deltaRect.left
                y += event.deltaRect.top

                target.setAttribute('data-x', x)
                target.setAttribute('data-y', y)
              }
            }
          });
        }
        const ctx = canv.getContext('2d');
        if (!append.hasAttribute('style')) {
          append.style.width = r.width * r.scaleX + 'px';
          append.style.height = r.height * r.scaleY + 'px';
        }
        canv.width = r.width * r.scaleX;
        canv.height = r.height * r.scaleY;
        const videoHeight = video.videoHeight;
        const videoWidth = video.videoWidth;
        const correctPosition = {
          width: videoWidth / width,
          height: videoHeight / height
        }
        ctx.drawImage(
          video,
          r.left * correctPosition.width,
          r.top * correctPosition.height,
          r.width * correctPosition.width * r.scaleX,
          r.height * correctPosition.height * r.scaleX,
          0,
          0,
          r.width * r.scaleX,
          r.height * r.scaleY);
        if (!find) {
          zones.appendChild(append)
        }
      })
      setTimeout(() => {
        fabric.util.requestAnimFrame(render);
      }, 0);
    });

    fabric.util.requestAnimFrame(function refresh() {
      fabricCanvas.renderAll();
      fabric.util.requestAnimFrame(refresh);
    });

    function resize() {
      video.removeAttribute('style');
      const videoRect = video.getBoundingClientRect();
      const vRatio = video.videoWidth / video.videoHeight;
      width = videoRect.width;
      height = width / vRatio;
      video.style.display = 'none';
      canvas.setAttribute('width', width);
      canvas.setAttribute('height', height);
      video.setAttribute('width', width);
      video.setAttribute('height', height);
      video.style.width = width + 'px';
      video.style.height = height + 'px';
      fabricCanvas.setDimensions({
        width,
        height
      })
    }

    window.addEventListener('orientationchange', resize);
    window.addEventListener('resize', resize);
  }


}
