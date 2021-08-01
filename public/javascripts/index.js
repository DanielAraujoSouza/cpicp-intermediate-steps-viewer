import CloudViewer from './CloudViewer.js'

const socket = io()

const viewer = new CloudViewer('#canvas')

const formField = document.querySelector('#cpip-form')
const srcCloudField = document.querySelector('#src-cloud-select')
const tgtCloudField = document.querySelector('#tgt-cloud-select')

const npField = document.querySelector('#np-cpip')
const rmseField = document.querySelector('#rmse-cpicp')
const axisGroup = document.querySelector('#axis-group')

const deltaField = document.querySelector('#delta-icp')
const maxDistField = document.querySelector('#max-dist-icp')
const numIterIcp = document.querySelector('#num-iter-icp')
const closestTypeGroup = document.querySelector('#closest-type-group')

const startBtn = document.querySelector('#startBtn')

const resultContainer = document.querySelector('#resultContainer')
const resultSpiner = document.querySelector('#resultSpiner')
const resetBtn = document.querySelector('#resultReset')
const resultBody = document.querySelector('#resultBody')

const alertContainer = document.querySelector('#alertContainer')

let resArray = []
let tgtCloudObj
let srcCloudObj

const makeGifBtn = document.querySelector('#makeGif')

let execStartTime = 0

async function insertCloudGifFrame(
  cloudViewer,
  gif,
  cloud,
  color,
  text,
  removeCloud
) {
  const cloudName = `cloud_${new Date().getTime()}`
  cloudViewer.addCloud(cloud, cloudName, color)
  cloudViewer.updateCanvas()
  const dataUrl = cloudViewer.canvas.toDataURL('image/png')

  const loadPromise = new Promise((resolve) => {
    const image = new Image()
    image.addEventListener('load', () => {
      resolve(image)
    })
    image.src = dataUrl
  }).then((img) => {
    const textCanvas = document.createElement('canvas')
    textCanvas.width = cloudViewer.canvas.clientWidth
    textCanvas.height = cloudViewer.canvas.clientHeight
    const ctx = textCanvas.getContext('2d')

    ctx.drawImage(img, 0, 0)
    ctx.lineWidth = 1
    ctx.fillStyle = '#CC00FF'
    ctx.lineStyle = '#ffff00'
    ctx.font = '18px sans-serif'
    ctx.fillText(text, 10, 20)

    gif.addFrame(ctx, { delay: 1000, copy: true })
    return ctx
  })

  if (removeCloud) {
    cloudViewer.removeCloudByLabel(cloudName)
  }
  return loadPromise
}

makeGifBtn.addEventListener('click', async () => {
  // Disable button
  makeGifBtn.setAttribute('disabled', 'disabled')
  const gif = new GIF({
    workers: 4,
    quality: 10,
    workerScript: '/javascripts/gif.js/gif.worker.js',
    width: viewer.canvas.clientWidth,
    height: viewer.canvas.clientHeight,
  })
  let pointSize = 0
  if (viewer.cloudGroup.children.length > 0) {
    pointSize = viewer.cloudGroup.children[0].material.size
  }
  viewer.reset()
  viewer.stopAnimation()

  const promisePool = []
  promisePool.push(
    insertCloudGifFrame(
      viewer,
      gif,
      tgtCloudObj,
      '#0000cc',
      'Target Cloud',
      false
    )
  )
  if (pointSize > 0) {
    viewer.setPointSize(pointSize)
  }
  promisePool.push(
    insertCloudGifFrame(
      viewer,
      gif,
      srcCloudObj,
      '#ff0000',
      'Source Cloud',
      true
    )
  )

  resArray.flat().forEach((cloudRes) => {
    if (cloudRes.srcAlgn) {
      promisePool.push(
        insertCloudGifFrame(
          viewer,
          gif,
          cloudRes.srcAlgn,
          '#ff0000',
          `np = ${cloudRes.np}, step = ${cloudRes.step}, RMSE = ${cloudRes.rmseGlobal}`,
          true
        )
      )
    }
  })

  gif.on('finished', (blob) => {
    window.open(URL.createObjectURL(blob))
    makeGifBtn.removeAttribute('disabled')
  })

  Promise.all(promisePool).then(() => {
    gif.render()
  })

  // viewer.reset()
  viewer.startAnimation()
})

function toggleFormState(enable) {
  if (enable === true) {
    formField.classList.remove('visually-hidden')
    resultContainer.classList.add('visually-hidden')

    startBtn.classList.remove('disabled')

    srcCloudField.removeAttribute('disabled')
    tgtCloudField.removeAttribute('disabled')
    npField.removeAttribute('disabled')
    rmseField.removeAttribute('disabled')
    deltaField.removeAttribute('disabled')
    maxDistField.removeAttribute('disabled')

    axisGroup.querySelectorAll('input').forEach((e) => {
      e.removeAttribute('disabled')
    })

    closestTypeGroup.querySelectorAll('input').forEach((e) => {
      e.removeAttribute('disabled')
    })
  } else {
    formField.classList.add('visually-hidden')
    resultContainer.classList.remove('visually-hidden')

    startBtn.classList.add('disabled')

    srcCloudField.setAttribute('disabled', 'disabled')
    tgtCloudField.setAttribute('disabled', 'disabled')
    npField.setAttribute('disabled', 'disabled')
    rmseField.setAttribute('disabled', 'disabled')
    deltaField.setAttribute('disabled', 'disabled')
    maxDistField.setAttribute('disabled', 'disabled')

    axisGroup.querySelectorAll('input').forEach((e) => {
      e.setAttribute('disabled', 'disabled')
    })

    closestTypeGroup.querySelectorAll('input').forEach((e) => {
      e.setAttribute('disabled', 'disabled')
    })
  }
}

function createListNode(id, label, classList) {
  const head = document.createElement('a')
  head.id = `itemHead-${id}`
  head.classList.add(
    'list-group-item',
    'd-flex',
    'align-items-center',
    ...classList
  )
  head.setAttribute('data-bs-toggle', 'collapse')
  head.setAttribute('href', `#itemBody-${id}`)
  head.setAttribute('role', 'button')
  head.setAttribute('aria-controls', `itemBody-${id}`)

  const icon = document.createElement('i')
  icon.classList.add('fas', 'fa-chevron-right', 'me-2')
  head.append(icon)

  const lbl = document.createElement('span')
  lbl.innerText = label
  head.append(lbl)

  const rankBadge = document.createElement('span')
  rankBadge.id = `itemRank-${id}`
  rankBadge.classList.add(
    'badge',
    'rounded-pill',
    'bg-light',
    'text-dark',
    'fw-light',
    'ms-auto'
  )
  rankBadge.setAttribute('title', 'RMSE rank position')
  head.append(rankBadge)

  const body = document.createElement('div')
  body.id = `itemBody-${id}`
  body.classList.add('collapse', 'list-group')

  body.addEventListener('show.bs.collapse', (e) => {
    e.stopPropagation()
    icon.classList.remove('fa-chevron-right')
    icon.classList.add('fa-chevron-down')
  })

  body.addEventListener('hide.bs.collapse', (e) => {
    e.stopPropagation()
    icon.classList.add('fa-chevron-right')
    icon.classList.remove('fa-chevron-down')
  })

  return { head, body }
}

function createListLeaf(label, cloud) {
  const leaf = document.createElement('div')
  leaf.classList.add(
    'list-group-item',
    'list-group-item-action',
    'd-flex',
    'w-100',
    'justify-content-between'
  )

  const lblRow = document.createElement('div')
  lblRow.classList.add('row')
  leaf.append(lblRow)

  const lbl = document.createElement('span')
  lbl.innerText = label
  lblRow.append(lbl)

  const lenLbl = document.createElement('small')
  lenLbl.classList.add('text-muted')
  lenLbl.innerHTML = `<b>Size:</b> ${cloud.numpts} Pts`
  lblRow.append(lenLbl)

  const addBtn = document.createElement('button')
  addBtn.classList.add('btn', 'rounded-circle')
  addBtn.setAttribute('title', 'Add to viewer')
  addBtn.addEventListener('click', () => {
    viewer.addCloud(
      cloud,
      label,
      `hsl(${Math.floor(Math.random() * 360)}, 100%, 50%)`
    )
  })
  leaf.append(addBtn)

  const icon = document.createElement('i')
  icon.classList.add('fas', 'fa-plus')
  addBtn.append(icon)

  return leaf
}

function createListDesc(rmse, tm, time) {
  const lg = document.createElement('div')
  lg.classList.add('list-group-item', 'fw-light')

  if (rmse) {
    const rmseRow = document.createElement('div')
    rmseRow.classList.add('row')
    lg.append(rmseRow)

    const rmseLbl = document.createElement('small')
    rmseLbl.classList.add('text-muted')
    rmseLbl.innerHTML = `<b>RMSE:</b> ${rmse}`
    rmseRow.append(rmseLbl)
  }

  if (time) {
    const timeRow = document.createElement('div')
    timeRow.classList.add('row')
    lg.append(timeRow)

    const timeLbl = document.createElement('small')
    timeLbl.classList.add('text-muted')
    timeLbl.innerHTML = `<b>Run Time:</b> ${time}`
    timeRow.append(timeLbl)
  }

  const tmLblRow = document.createElement('div')
  tmLblRow.classList.add('row')
  lg.append(tmLblRow)

  if (tm) {
    const tmLbl = document.createElement('small')
    tmLbl.classList.add('text-muted')
    tmLbl.innerHTML = '<b>Transformation Matrix:</b>'
    tmLblRow.append(tmLbl)

    const tmRow = document.createElement('div')
    tmRow.classList.add('row', 'row-cols-4')
    lg.append(tmRow)

    tm.forEach((row) => {
      row.forEach((e) => {
        const col = document.createElement('div')
        col.classList.add('col', 'overflow-hidden')
        tmRow.append(col)

        const eValue = document.createElement('small')
        eValue.classList.add('text-muted')
        eValue.innerHTML = e.re
        col.append(eValue)
      })
    })
  } else {
    const tmLbl = document.createElement('small')
    tmLbl.classList.add('text-muted')
    tmLbl.innerHTML = '<i>ICP not executed!</i>'
    tmLblRow.append(tmLbl)
  }

  return lg
}

function createAlert(msg, type) {
  const alert = document.createElement('div')
  alert.classList.add(
    'alert',
    `alert-${type === 'ok' ? 'success' : 'danger'}`,
    'alert-dismissible',
    'fade',
    'show'
  )

  const icon = document.createElement('i')
  icon.classList.add(
    'fas',
    `fa-${type === 'ok' ? 'check-circle' : 'exclamation-circle'}`,
    'me-2'
  )
  alert.append(icon)

  const btnClose = document.createElement('button')
  btnClose.classList.add('btn-close')
  btnClose.setAttribute('type', 'button')
  btnClose.setAttribute('data-bs-dismiss', 'alert')
  btnClose.setAttribute('aria-label', 'Close')
  alert.append(btnClose)

  const text = document.createElement('span')
  text.innerText = msg
  alert.append(text)

  return alert
}

resetBtn.addEventListener('click', () => {
  resArray = []
  toggleFormState(true)
  formField.reset()
  viewer.reset()
  resultContainer.classList.add('visually-hidden')
  resultSpiner.classList.remove('visually-hidden')
  resetBtn.classList.add('visually-hidden')
  resultBody.innerHTML = ''
  makeGifBtn.classList.add('visually-hidden')
})

formField.addEventListener('submit', (e) => {
  e.preventDefault()
  alertContainer.innerHTML = ''

  // Form Vadidation
  if (srcCloudField.value.length < 4) {
    alertContainer.append(createAlert('Select a source cloud', 'erro'))
    return
  }

  if (tgtCloudField.value.length < 4) {
    alertContainer.append(createAlert('Select a target cloud', 'erro'))
    return
  }

  if (npField.value < 2) {
    alertContainer.append(
      createAlert(
        'Enter a valid value for the number of partitions (>=2)',
        'erro'
      )
    )
    return
  }

  if (rmseField.value < 0) {
    alertContainer.append(
      createAlert('Enter a valid value for the stop criteria (>=0)', 'erro')
    )
    return
  }

  const axisValue = axisGroup.querySelector('input:checked').value
  if (!['x', 'y', 'z'].includes(axisValue)) {
    alertContainer.append(
      createAlert('Select a valid axis (x, y or z)', 'erro')
    )
    return
  }

  if (deltaField.value < 0) {
    alertContainer.append(
      createAlert('Enter a valid value for the ICP stop criteria (>=0)', 'erro')
    )
    return
  }

  if (maxDistField.value <= 0) {
    alertContainer.append(
      createAlert(
        'Enter a valid value for the maximum distance between points (>0)',
        'erro'
      )
    )
    return
  }

  if (numIterIcp.value <= 0) {
    alertContainer.append(
      createAlert(
        'Enter a valid value for the number of ICP iterations (>0)',
        'erro'
      )
    )
    return
  }

  const closestValue = closestTypeGroup.querySelector('input:checked').value
  if (!['bf', 'tree'].includes(closestValue)) {
    alertContainer.append(
      createAlert('Select a valid Nearest Point Algorithm', 'erro')
    )
    return
  }

  const cpicpData = {
    srcName: srcCloudField.value,
    tgtName: tgtCloudField.value,
    np: +npField.value,
    k: +numIterIcp.value,
    rmse: +rmseField.value,
    axis: axisValue,
    delta: +deltaField.value,
    maxDist: +maxDistField.value,
    closestType: closestValue,
  }

  toggleFormState(false)
  resultContainer.classList.remove('visually-hidden')
  resultSpiner.classList.remove('visually-hidden')
  resetBtn.classList.add('visually-hidden')

  execStartTime = performance.now()
  socket.emit('get-cpicp', cpicpData)
})

srcCloudField.addEventListener('change', () => {
  const cloudName = srcCloudField.value
  if (cloudName) {
    socket.emit('get-src', cloudName)
    viewer.removeCloudByLabel('Source cloud')
  }
})

tgtCloudField.addEventListener('change', () => {
  const cloudName = tgtCloudField.value
  if (cloudName) {
    socket.emit('get-tgt', cloudName)
    viewer.removeCloudByLabel('Target cloud')
  }
})

socket.on('res-src', (srcCloud) => {
  if (srcCloud) {
    viewer.addCloud(srcCloud, 'Source cloud', '#ff0000')
    srcCloudObj = srcCloud
  }
})

socket.on('res-tgt', (tgtCloud) => {
  if (tgtCloud) {
    viewer.addCloud(tgtCloud, 'Target cloud', '#0000cc')
    tgtCloudObj = tgtCloud
  }
})

socket.on('res-cpicp-clouds', (clouds) => {
  resultBody.append(createListLeaf('Original Source', clouds.src))
  resultBody.append(createListLeaf('Original Target', clouds.tgt))
})

socket.on('res-cpicp-partition', (partRes) => {
  resArray.push(partRes)
  const np = partRes.length
  const partNode = createListNode(np, `${np} Partitions`, [
    'bg-primary',
    'text-white',
  ])
  resultBody.append(...Object.values(partNode))

  partRes.forEach((steps, idx) => {
    const ns = idx + 1
    const tm = steps.icpRes ? steps.icpRes.tm : null
    const subNode = createListNode(`${np}-${ns}`, `Step ${ns}`, [
      'bg-info',
      'text-white',
    ])
    partNode.body.append(...Object.values(subNode))

    subNode.body.append(createListDesc(steps.rmseGlobal, tm, steps.time))
    subNode.body.append(createListLeaf(`SrcPart P${np}-S${ns}`, steps.srcPart))
    subNode.body.append(createListLeaf(`TgtPart P${np}-S${ns}`, steps.tgtPart))
    if (steps.icpRes !== undefined) {
      subNode.body.append(
        createListLeaf(`SrcPart Algn P${np}-S${ns}`, steps.icpRes.algnCloud)
      )
      subNode.body.append(
        createListLeaf(`Global Src Algn P${np}-S${ns}`, steps.srcAlgn)
      )
    }
  })
})

socket.on('res-cpicp-done', () => {
  const execTime = performance.now() - execStartTime
  console.log(`Time: ${execTime} ms`)
  resultSpiner.classList.add('visually-hidden')
  resetBtn.classList.remove('visually-hidden')
  makeGifBtn.classList.remove('visually-hidden')

  // Ranking
  const rankedResults = resArray.flat().sort((a, b) => {
    const rmseA = a.rmseGlobal || Number.MAX_VALUE
    const rmseB = b.rmseGlobal || Number.MAX_VALUE
    return rmseA - rmseB
  })

  const rankPartRes = []
  rankedResults.forEach((e, i) => {
    rankPartRes[e.np] = rankPartRes[e.np] || { id: e.np, rank: i + 1 }
    document.querySelector(
      `#itemRank-${e.np}-${e.step + 1}`
    ).innerText = `RANK#${i + 1}`
  })

  rankPartRes.forEach((e) => {
    document.querySelector(`#itemRank-${e.id}`).innerText = `RANK#${e.rank}`
  })
})
