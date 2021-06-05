/**
 * Cloud Viewer
 *
 * Three.js-based 3D point cloud viewer
 *
 * @author Daniel Araújo Chaves Souza (daniel_araujo@alu.ufc.br)
 * @year 2021
 */
import * as THREE from '/javascripts/three.js/three.module.min.js'
import { TrackballControls } from '/javascripts/three.js/TrackballControls.js'

class CloudViewer {
  constructor(containerId) {
    this.container = document.querySelector(containerId)
    this.canvas = this.#createCanvas()
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
    })
    this.scene = new THREE.Scene()

    // Camera
    this.camera = new THREE.PerspectiveCamera()
    this.camera.aspect = this.canvas.clientWidth / this.canvas.clientHeight
    this.camera.fov = 75
    this.cameraAxis = 'z'

    // Cotroles
    this.autoScale = true
    this.controls = new TrackballControls(this.camera, this.canvas)
    this.controls.rotateSpeed = 2.0
    this.controls.staticMoving = true

    // Group
    this.cloudGroup = new THREE.Group()
    this.scene.add(this.cloudGroup)

    // Menu
    this.#createMenu()
    this.capturePicture = false

    // Axis
    this.axisCanvas = this.#createAxisCanvas()
    this.axisRender = new THREE.WebGLRenderer({
      alpha: true,
      canvas: this.axisCanvas,
    })
    this.axisRender.setClearColor(0x000000, 0)
    this.axisScene = new THREE.Scene()

    const aspect = this.axisCanvas.clientWidth / this.axisCanvas.clientHeight
    this.axisCamera = new THREE.PerspectiveCamera(50, aspect, 1, 1000)
    this.axisCamera.up = this.camera.up

    var arrowPos = new THREE.Vector3(0, 0, 0)
    this.axisScene.add(
      new THREE.ArrowHelper(
        new THREE.Vector3(1, 0, 0),
        arrowPos,
        100,
        0xff0000,
        20,
        10
      )
    )
    this.axisScene.add(
      new THREE.ArrowHelper(
        new THREE.Vector3(0, 1, 0),
        arrowPos,
        100,
        0x00ff00,
        20,
        10
      )
    )
    this.axisScene.add(
      new THREE.ArrowHelper(
        new THREE.Vector3(0, 0, 1),
        arrowPos,
        100,
        0x0000ff,
        20,
        10
      )
    )

    // Render
    requestAnimationFrame(this.#render.bind(this))
  }

  addCloud(cloud, label, color) {
    const cloudColor = new THREE.Color(color)
    const cloudMesh = this.#generateCloudMesh(cloud, label, cloudColor)
    this.cloudGroup.add(cloudMesh)
    const { _, radius } = this.fitCanvasToCloudGroup()

    this.#includeMenuOption(label, cloudMesh.id, cloudColor, cloud.numpts)

    if (this.autoScale) {
      const pointSize = radius / 30
      this.setPointSize(pointSize)
    }
  }

  removeCloudByLabel(cloudLbl) {
    const childId = this.cloudGroup.children.findIndex(
      (e) => e.name === cloudLbl
    )

    if (childId >= 0) {
      const cloudId = this.cloudGroup.children[childId].id
      this.#removeMenuOption(cloudId)
      this.#removeCloudById(cloudId)
      this.fitCanvasToCloudGroup()
    }
  }

  setPointSize(pointSize) {
    this.#updateGroupPointSize(pointSize)
    this.#updatePointSizeRange(pointSize)
  }

  setAutoScale(value) {
    this.autoScale = !!value
  }

  setCameraAxis(axis) {
    if (axis === 'x') {
      this.cameraAxis = 'x'
      this.camera.up.set(0, 0, 1)
    } else if (axis === 'y') {
      this.cameraAxis = 'y'
      this.camera.up.set(1, 0, 0)
    } else {
      this.cameraAxis = 'z'
      this.camera.up.set(0, 1, 0)
    }
    this.fitCanvasToCloudGroup(true)
  }

  reset() {
    this.cloudGroup.children.splice(0).forEach((cloudMesh) => {
      this.#removeMenuOption(cloudMesh.id)
    })
  }

  fitCanvasToCloudGroup(force = false) {
    const { center, radius } = this.#getGroupBoundingSphere()

    if (this.autoScale || force) {
      const radFov = (this.camera.fov * Math.PI) / 180
      const newDist = (2 * radius) / Math.tan(radFov / 2)

      if (this.cameraAxis === 'x') {
        this.camera.position.set(center.x + newDist, center.y, center.z)
      } else if (this.cameraAxis === 'y') {
        this.camera.position.set(center.x, center.y + newDist, center.z)
      } else {
        this.camera.position.set(center.x, center.y, center.z + newDist)
      }
    }

    this.controls.target.set(center.x, center.y, center.z)
    this.camera.updateProjectionMatrix()
    this.controls.handleResize()

    return { center, radius }
  }

  #createAxisCanvas() {
    const canvas = document.createElement('canvas')
    canvas.classList.add(
      'mx-4',
      'my-2',
      'position-absolute',
      'bottom-0',
      'end-0'
    )
    canvas.style.setProperty('width', '8rem')
    canvas.style.setProperty('height', '8rem')
    this.container.append(canvas)
    return canvas
  }

  #createCanvas() {
    this.container.innerHTML = ''
    const canvas = document.createElement('canvas')
    canvas.classList.add('w-100', 'h-100')
    this.container.append(canvas)
    return canvas
  }

  #createMenu() {
    const menuBar = document.createElement('div')
    menuBar.classList.add('mx-4', 'my-2', 'position-absolute', 'top-0', 'end-0')
    this.container.append(menuBar)

    // Take picture
    {
      const takePicBtn = document.createElement('button')
      takePicBtn.classList.add('m-1', 'btn', 'btn-primary')
      takePicBtn.setAttribute('type', 'button')
      takePicBtn.setAttribute('title', 'Take a picture')
      takePicBtn.addEventListener('click', () => {
        this.#takePicture()
      })
      menuBar.append(takePicBtn)

      const icon = document.createElement('i')
      icon.classList.add('fas', 'fa-image')
      takePicBtn.append(icon)
    }
    // Settings Icon
    {
      const settingsBtn = document.createElement('button')
      settingsBtn.classList.add('m-1', 'btn', 'btn-primary')
      settingsBtn.setAttribute('type', 'button')
      settingsBtn.setAttribute('data-bs-toggle', 'offcanvas')
      settingsBtn.setAttribute('data-bs-target', '#offcanvasViewer')
      settingsBtn.setAttribute('aria-controls', 'offcanvasViewer')
      settingsBtn.setAttribute('title', 'Settings menu')
      menuBar.append(settingsBtn)

      const icon = document.createElement('i')
      icon.classList.add('fas', 'fa-bars')
      settingsBtn.append(icon)
    }

    const offCanvas = document.createElement('div')
    offCanvas.classList.add('offcanvas', 'offcanvas-end')
    offCanvas.id = 'offcanvasViewer'
    offCanvas.setAttribute('tabindex', -1)
    offCanvas.setAttribute('aria-labelledby', 'offcanvasViewerLabel')
    this.container.append(offCanvas)

    // Offcanvas Header
    {
      const offCanvasHead = document.createElement('div')
      offCanvasHead.classList.add('offcanvas-header', 'bg-light', 'mb-2')
      offCanvas.append(offCanvasHead)

      const offcanvasViewerLabel = document.createElement('h5')
      offcanvasViewerLabel.id = 'offcanvasViewerLabel'
      offcanvasViewerLabel.innerText = 'Settings'
      offCanvasHead.append(offcanvasViewerLabel)

      const btnClose = document.createElement('button')
      btnClose.classList.add('btn-close', 'text-reset')
      btnClose.setAttribute('type', 'button')
      btnClose.setAttribute('data-bs-dismiss', 'offcanvas')
      btnClose.setAttribute('aria-label', 'Close')
      offCanvasHead.append(btnClose)
    }

    // Offcanvas Body
    {
      const labelRow = document.createElement('div')
      labelRow.id = 'offcanvas-config'
      labelRow.classList.add('row', 'p-3', 'collapse', 'mx-2')
      offCanvas.append(labelRow)

      // Point Size
      {
        const labelPtSize = document.createElement('label')
        labelPtSize.classList.add('form-label')
        labelPtSize.setAttribute('for', 'pointSize')
        labelPtSize.innerText = 'Point size'
        labelRow.append(labelPtSize)

        const inputRangePtSize = document.createElement('input')
        inputRangePtSize.id = 'pointSizeRange'
        inputRangePtSize.classList.add('form-range')
        inputRangePtSize.setAttribute('type', 'range')
        inputRangePtSize.setAttribute('min', 0)
        inputRangePtSize.addEventListener('input', (e) => {
          this.#updateGroupPointSize(e.target.value)
        })
        labelRow.append(inputRangePtSize)
      }

      // Camera angle
      {
        const labelCamFov = document.createElement('label')
        labelCamFov.classList.add('form-label')
        labelCamFov.setAttribute('for', 'pointSize')
        labelCamFov.innerText = 'Field of view (angle)'
        labelRow.append(labelCamFov)

        const inputRangeCamFov = document.createElement('input')
        inputRangeCamFov.id = 'pointSizeRange'
        inputRangeCamFov.classList.add('form-range')
        inputRangeCamFov.setAttribute('type', 'range')
        inputRangeCamFov.setAttribute('min', 1)
        inputRangeCamFov.setAttribute('max', 175)
        inputRangeCamFov.setAttribute('step', 1)
        inputRangeCamFov.setAttribute('value', this.camera.fov)
        inputRangeCamFov.addEventListener('input', (e) => {
          this.#updateCamFov(e.target.value)
        })
        labelRow.append(inputRangeCamFov)
      }

      // Standard camera axis
      {
        const axisLabel = document.createElement('label')
        axisLabel.classList.add('form-label')
        axisLabel.innerText = 'Standard camera axis'
        labelRow.append(axisLabel)

        const axisBtnGroup = document.createElement('div')
        axisBtnGroup.classList.add('btn-group', 'btn-group-sm')
        axisBtnGroup.setAttribute('role', 'group')
        axisBtnGroup.setAttribute('aria-label', 'Standard camera axis')
        labelRow.append(axisBtnGroup)

        // X
        const axisInputX = document.createElement('input')
        axisInputX.id = 'axisCamX'
        axisInputX.classList.add('btn-check')
        axisInputX.setAttribute('type', 'radio')
        axisInputX.setAttribute('name', 'axis-cam')
        axisInputX.setAttribute('autocomplete', 'off')
        axisInputX.setAttribute('value', 'x')
        axisInputX.addEventListener('change', (e) => {
          this.setCameraAxis(e.target.value)
        })
        axisBtnGroup.append(axisInputX)

        const axisLabelX = document.createElement('label')
        axisLabelX.classList.add('btn', 'btn-outline-primary')
        axisLabelX.setAttribute('for', 'axisCamX')
        axisLabelX.innerText = 'X'
        axisBtnGroup.append(axisLabelX)

        // Y
        const axisInputY = document.createElement('input')
        axisInputY.id = 'axisCamY'
        axisInputY.classList.add('btn-check')
        axisInputY.setAttribute('type', 'radio')
        axisInputY.setAttribute('name', 'axis-cam')
        axisInputY.setAttribute('autocomplete', 'off')
        axisInputY.setAttribute('value', 'y')
        axisInputY.addEventListener('change', (e) => {
          this.setCameraAxis(e.target.value)
        })
        axisBtnGroup.append(axisInputY)

        const axisLabelY = document.createElement('label')
        axisLabelY.classList.add('btn', 'btn-outline-primary')
        axisLabelY.setAttribute('for', 'axisCamY')
        axisLabelY.innerText = 'Y'
        axisBtnGroup.append(axisLabelY)

        // Z (Standard)
        const axisInputZ = document.createElement('input')
        axisInputZ.id = 'axisCamZ'
        axisInputZ.classList.add('btn-check')
        axisInputZ.setAttribute('type', 'radio')
        axisInputZ.setAttribute('name', 'axis-cam')
        axisInputZ.setAttribute('autocomplete', 'off')
        axisInputZ.setAttribute('checked', 'checked')
        axisInputZ.setAttribute('value', 'z')
        axisInputZ.addEventListener('change', (e) => {
          this.setCameraAxis(e.target.value)
        })
        axisBtnGroup.append(axisInputZ)

        const axisLabelZ = document.createElement('label')
        axisLabelZ.classList.add('btn', 'btn-outline-primary')
        axisLabelZ.setAttribute('for', 'axisCamZ')
        axisLabelZ.innerText = 'Z'
        axisBtnGroup.append(axisLabelZ)
      }

      // Automatic resizing
      {
        const autoResize = document.createElement('div')
        autoResize.classList.add('form-check', 'form-switch', 'mt-3')
        labelRow.append(autoResize)

        const inputAutoResize = document.createElement('input')
        inputAutoResize.id = 'autoResizeSwitch'
        inputAutoResize.classList.add('form-check-input')
        inputAutoResize.setAttribute('type', 'checkbox')
        inputAutoResize.setAttribute('checked', 'checked')
        inputAutoResize.addEventListener('change', (e) => {
          this.setAutoScale(e.target.checked)
        })
        autoResize.append(inputAutoResize)

        const labelAutoResize = document.createElement('label')
        labelAutoResize.classList.add('form-check-label')
        labelAutoResize.setAttribute('for', 'autoResizeSwitch')
        labelAutoResize.innerText = 'Automatic resizing'
        autoResize.append(labelAutoResize)
      }

      // Cloud Menu
      {
        const cloudRow = document.createElement('div')
        cloudRow.classList.add(
          'bg-light',
          'd-flex',
          'align-items-center',
          'px-3'
        )
        offCanvas.append(cloudRow)

        const cloudTitle = document.createElement('h5')
        cloudTitle.classList.add('my-2')
        cloudTitle.innerText = 'Clouds'
        cloudRow.append(cloudTitle)

        // Remove All Clouds
        const delBtn = document.createElement('button')
        delBtn.classList.add('btn', 'rounded-circle', 'ms-auto')
        delBtn.setAttribute('title', 'Remove all clouds')
        delBtn.addEventListener('click', () => {
          this.reset()
        })
        cloudRow.append(delBtn)

        const delBtnIcon = document.createElement('i')
        delBtnIcon.classList.add('fas', 'fa-trash')
        delBtn.append(delBtnIcon)

        // Fit to center
        const fitBtn = document.createElement('button')
        fitBtn.classList.add('btn', 'rounded-circle')
        fitBtn.setAttribute('title', 'Fit to center')
        fitBtn.addEventListener('click', () => {
          this.fitCanvasToCloudGroup(true)
        })
        cloudRow.append(fitBtn)

        const fitBtnIcon = document.createElement('i')
        fitBtnIcon.classList.add('fas', 'fa-compress-arrows-alt')
        fitBtn.append(fitBtnIcon)

        // Show Viewer Config
        const configBtn = document.createElement('button')
        configBtn.classList.add('btn', 'rounded-circle')
        configBtn.setAttribute('data-bs-toggle', 'collapse')
        configBtn.setAttribute('href', '#offcanvas-config')
        configBtn.setAttribute('role', 'button')
        configBtn.setAttribute('aria-controls', 'offcanvas-config')
        configBtn.setAttribute('title', 'View Settings')
        cloudRow.append(configBtn)

        const configBtnIcon = document.createElement('i')
        configBtnIcon.classList.add('fas', 'fa-cog')
        configBtn.append(configBtnIcon)
      }

      // Container of Clouds
      const cloudOptions = document.createElement('div')
      cloudOptions.id = 'cloudContainer'
      cloudOptions.classList.add('container', 'overflow-auto', 'h-auto', 'p-1')
      offCanvas.append(cloudOptions)
    }
  }

  #dowloadCloudById(cloudId) {
    const cloud = this.cloudGroup.children.find((e) => e.id === cloudId)
    if (cloud) {
      const coord = cloud.geometry.attributes.position.array
      const cloudObj = {
        numpts: 0,
        points: new Array(coord.length / 3),
      }

      for (let i = 0; i < coord.length; i += 3) {
        cloudObj.points[cloudObj.numpts++] = {
          x: coord[i],
          y: coord[i + 1],
          z: coord[i + 2],
        }
      }
      const cloudData = URL.createObjectURL(
        new Blob([JSON.stringify(cloudObj, null, 2)], {
          type: 'text/plain',
        })
      )
      this.#downloadFile(cloudData, `${cloud.name}.json`)
    }
  }

  #downloadFile(urlData, filename) {
    const link = document.createElement('a')
    link.setAttribute('download', filename)
    link.href = urlData
    this.container.appendChild(link)
    link.click()
    link.remove()
  }

  #generateCloudMesh(cloud, label, color, pointSize) {
    const geometry = new THREE.BufferGeometry()
    const pointArr = cloud.points.reduce((res, e, i) => {
      res[i * 3] = e.x
      res[i * 3 + 1] = e.y
      res[i * 3 + 2] = e.z
      return res
    }, new Array(cloud.points.length * 3))

    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(pointArr, 3)
    )
    geometry.computeBoundingSphere()
    const radius = geometry.boundingSphere.radius

    const material = new THREE.PointsMaterial({
      size: pointSize || radius / 30,
    })
    material.color.set(color)

    const mesh = new THREE.Points(geometry, material)
    mesh.name = label
    mesh.length = cloud.points.length
    return mesh
  }

  #getGroupBoundingSphere() {
    const bbox = new THREE.Box3().setFromObject(this.cloudGroup)
    return bbox.getBoundingSphere(
      new THREE.Sphere(bbox.getCenter(new THREE.Vector3()))
    )
  }

  #hideCloudById(cloudId) {
    const cloud = this.cloudGroup.children.find((e) => e.id === +cloudId)

    if (cloud) {
      cloud.visible = false
    }
  }

  #includeMenuOption(label, id, color, size) {
    let offCanvas = this.container.querySelector('#offcanvasViewer')

    if (!offCanvas) {
      this.#createMenu()
    }

    const cloudContainer = this.container.querySelector('#cloudContainer')

    const row = document.createElement('div')
    row.classList.add(
      'd-flex',
      'flex-row',
      'w-100',
      'align-items-center',
      'p-2',
      'list-group-item-action'
    )
    row.id = `cloudOption-${id}`
    cloudContainer.append(row)

    // Input Color
    {
      const colorCol = document.createElement('div')
      colorCol.classList.add('d-flex', 'flex-column')
      colorCol.style.setProperty('width', '3rem')
      row.append(colorCol)

      const colorInput = document.createElement('input')
      colorInput.id = `colorOption-${id}`
      colorInput.classList.add('form-control', 'form-control-color')
      colorInput.setAttribute('type', 'color')
      colorInput.setAttribute('title', 'Choose cloud color')
      colorInput.setAttribute('cloud-id', id)
      colorInput.setAttribute('value', `#${color.getHexString()}`)
      colorCol.append(colorInput)

      colorCol.addEventListener('input', (e) => {
        const newColor = e.target.value
        this.#updateCloudColor(id, newColor)
      })
    }
    // Color label
    {
      const labelCol = document.createElement('div')
      labelCol.classList.add('d-flex', 'flex-column', 'me-auto', 'px-3')
      row.append(labelCol)

      const labelCloud = document.createElement('label')
      labelCloud.setAttribute('for', `colorOption-${id}`)
      labelCloud.innerText = label
      labelCol.append(labelCloud)

      const labelSize = document.createElement('small')
      labelSize.classList.add('text-muted')
      labelSize.innerText = `${size} Pts`
      labelCol.append(labelSize)
    }

    // Download JSON Cloud
    {
      const dowloadCloudBtn = document.createElement('button')
      dowloadCloudBtn.classList.add('btn', 'p-2')
      dowloadCloudBtn.setAttribute('title', 'Dowload JSON cloud')
      dowloadCloudBtn.addEventListener('click', () => {
        this.#dowloadCloudById(id)
      })
      row.append(dowloadCloudBtn)

      const dowloadCloudBtnIcon = document.createElement('i')
      dowloadCloudBtnIcon.classList.add(
        'fas',
        'fa-file-download',
        'link-secondary'
      )
      dowloadCloudBtn.append(dowloadCloudBtnIcon)
    }

    const showBtn = document.createElement('button')
    const hideBtn = document.createElement('button')

    // Show Button
    {
      showBtn.classList.add('btn', 'visually-hidden', 'p-2')
      showBtn.setAttribute('title', 'Show cloud')
      showBtn.addEventListener('click', () => {
        showBtn.classList.add('visually-hidden')
        hideBtn.classList.remove('visually-hidden')
        this.#showCloudById(id)
      })
      row.append(showBtn)

      const showBtnIcon = document.createElement('i')
      showBtnIcon.classList.add('fas', 'fa-eye-slash', 'link-secondary')
      showBtn.append(showBtnIcon)
    }

    // Hidden Button
    {
      hideBtn.classList.add('btn', 'p-2')
      hideBtn.setAttribute('title', 'Hide cloud')
      hideBtn.addEventListener('click', () => {
        showBtn.classList.remove('visually-hidden')
        hideBtn.classList.add('visually-hidden')
        this.#hideCloudById(id)
      })
      row.append(hideBtn)

      const hideBtnIcon = document.createElement('i')
      hideBtnIcon.classList.add('fas', 'fa-eye', 'link-secondary')
      hideBtn.append(hideBtnIcon)
    }

    // Remove Button
    {
      const removeBtn = document.createElement('button')
      removeBtn.classList.add('btn', 'p-2')
      removeBtn.setAttribute('title', 'Remove cloud')
      removeBtn.addEventListener('click', () => {
        row.remove()
        this.#removeCloudById(id)
      })
      row.append(removeBtn)

      const removeBtnIcon = document.createElement('i')
      removeBtnIcon.classList.add('fas', 'fa-trash', 'link-secondary')
      removeBtn.append(removeBtnIcon)
    }
  }

  #removeCloudById(cloudId) {
    const childId = this.cloudGroup.children.findIndex((e) => e.id === +cloudId)
    if (childId >= 0) {
      this.cloudGroup.children.splice(childId, 1)
    }
  }

  #removeMenuOption(cloudId) {
    const row = this.container.querySelector(`#cloudOption-${cloudId}`)
    if (!!row) {
      row.remove()
    }
  }

  #render() {
    if (this.#resizeRendererToDisplaySize()) {
      const cv = this.renderer.domElement
      this.camera.aspect = cv.clientWidth / cv.clientHeight
      this.camera.updateProjectionMatrix()
      this.controls.handleResize()
    }
    this.renderer.render(this.scene, this.camera)
    requestAnimationFrame(this.#render.bind(this))
    this.controls.update()

    this.axisCamera.position.copy(this.camera.position)
    this.axisCamera.position.sub(this.controls.target)
    this.axisCamera.position.setLength(300)
    this.axisCamera.lookAt(this.axisScene.position)

    this.axisRender.render(this.axisScene, this.axisCamera)

    if (this.capturePicture == true) {
      this.capturePicture = false
      const imgData = this.renderer.domElement.toDataURL()
      this.#downloadFile(imgData, `viwer-${new Date().getTime()}.png`)
    }
  }

  #resizeRendererToDisplaySize() {
    const canvas = this.renderer.domElement
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    const needResize = canvas.width !== width || canvas.height !== height
    if (needResize) {
      this.renderer.setSize(width, height, false)
    }
    return needResize
  }

  #showCloudById(cloudId) {
    const cloud = this.cloudGroup.children.find((e) => e.id === +cloudId)

    if (cloud) {
      cloud.visible = true
    }
  }

  #takePicture() {
    this.capturePicture = true
  }

  #updateCamFov(fov) {
    const { _, radius } = this.#getGroupBoundingSphere()
    this.camera.fov = fov

    const radFov = (fov * Math.PI) / 180
    this.camera.far = (4 * Math.PI * radius) / Math.tan(radFov / 2)
    this.controls.maxDistance = this.camera.far
    this.controls.minDistance = this.camera.near

    this.fitCanvasToCloudGroup()

    this.camera.updateProjectionMatrix()
    this.controls.handleResize()
  }

  #updateCloudColor(cloudId, newColor) {
    this.cloudGroup.children
      .filter((e) => e.id === +cloudId)
      .forEach((cloud) => {
        const materialColor = new THREE.Color(newColor)
        cloud.material.color.set(materialColor)
        cloud.material.needsUpdate = true
      })
  }

  #updateGroupPointSize(pointSize) {
    this.cloudGroup.children.forEach((cloud) => {
      cloud.material.size = pointSize
      cloud.material.needsUpdate = true
    })
  }

  #updatePointSizeRange(pointSize) {
    let pointSizeRange = this.container.querySelector('#pointSizeRange')
    pointSizeRange.setAttribute('max', pointSize * 4)
    pointSizeRange.setAttribute('step', pointSize / 100)
    pointSizeRange.setAttribute('value', pointSize)
  }
}

export default CloudViewer
