import CloudViewer from '/javascripts/CloudViewer.js';

const socket = io();

const viewer = new CloudViewer('#canvas');

const formField = document.querySelector('#cpip-form');
const srcCloudField = document.querySelector('#src-cloud-select');
const tgtCloudField = document.querySelector('#tgt-cloud-select');

const npField = document.querySelector('#np-cpip');
const rmseField = document.querySelector('#rmse-cpicp');
const axisGroup = document.querySelector('#axis-group');

const deltaField = document.querySelector('#delta-icp');
const maxDistField = document.querySelector('#max-dist-icp');
const closestTypeGroup = document.querySelector('#closest-type-group');

const startBtn = document.querySelector('#startBtn');

const resultContainer = document.querySelector('#resultContainer');
const resultSpiner = document.querySelector('#resultSpiner');
const resetBtn = document.querySelector('#resultReset');
const resultBody = document.querySelector('#resultBody');

let resArray = [];

resetBtn.addEventListener('click', () => {
  resArray = [];
  toggleFormState(true);
  formField.reset();
  viewer.reset();
  resultContainer.classList.add('visually-hidden');
  resultSpiner.classList.remove('visually-hidden');
  resetBtn.classList.add('visually-hidden');
  resultBody.innerHTML = '';
});

formField.addEventListener('submit', (e) => {
  e.preventDefault();

  const axisValue = axisGroup.querySelector('input:checked').value;
  const closestValue = closestTypeGroup.querySelector('input:checked').value;

  const cpicpData = {
    srcName: srcCloudField.value,
    tgtName: tgtCloudField.value,
    np: +npField.value,
    k: 30,
    rmse: +rmseField.value,
    axis: axisValue,
    delta: +deltaField.value,
    maxDist: +maxDistField.value,
    closestType: closestValue,
  };

  toggleFormState(false);
  resultContainer.classList.remove('visually-hidden');
  resultSpiner.classList.remove('visually-hidden');
  resetBtn.classList.add('visually-hidden');

  socket.emit('get-cpicp', cpicpData);
});

srcCloudField.addEventListener('change', () => {
  const cloudName = srcCloudField.value;
  if (cloudName) {
    socket.emit('get-src', cloudName);
    viewer.removeCloudByLabel('Source cloud');
  }
});

tgtCloudField.addEventListener('change', () => {
  const cloudName = tgtCloudField.value;
  if (cloudName) {
    socket.emit('get-tgt', cloudName);
    viewer.removeCloudByLabel('Target cloud');
  }
});

socket.on('res-src', (srcCloud) => {
  if (!srcCloud) {
    alert('SRC vazia!');
  } else {
    viewer.addCloud(srcCloud, 'Source cloud', '#ff0000');
  }
});

socket.on('res-tgt', (tgtCloud) => {
  if (!tgtCloud) {
    alert('TGT vazia!');
  } else {
    viewer.addCloud(tgtCloud, 'Target cloud', '#0000cc');
  }
});

socket.on('res-cpicp-clouds', (clouds) => {
  resultBody.append(createListLeaf('Source Original', clouds.src));
  resultBody.append(createListLeaf('Target Original', clouds.tgt));
});

socket.on('res-cpicp-partition', (partRes) => {
  resArray.push(partRes);
  const np = partRes.length;
  const partNode = createListNode(np, `${np} Partições`, ['bg-primary', 'text-white']);
  resultBody.append(...Object.values(partNode));

  partRes.forEach((steps, idx) => {
    const ns = idx + 1;
    const tm = steps.icpRes ? steps.icpRes.tm : null;
    const subNode = createListNode(`${np}-${ns}`, `Passo ${ns}`, ['bg-info', 'text-white']);
    partNode.body.append(...Object.values(subNode));
    
    subNode.body.append(createListDesc(steps.rmseGlobal, tm, steps.time));
    subNode.body.append(createListLeaf(`SrcPart P${np}-S${ns}`, steps.srcPart));
    subNode.body.append(createListLeaf(`TgtPart P${np}-S${ns}`, steps.tgtPart));
    if (steps.icpRes !== undefined) {
      subNode.body.append(createListLeaf(`srcPart Algn P${np}-S${ns}`, steps.icpRes.algnCloud));
      subNode.body.append(createListLeaf(`Global Src Algn P${np}-S${ns}`, steps.srcAlgn));
    }
  });
});

socket.on('res-cpicp-done', () => {
  resultSpiner.classList.add('visually-hidden');
  resetBtn.classList.remove('visually-hidden');

  // Ranking
  const rankedResults = resArray.flat().sort((a, b) => {
    const rmseA = a.rmseGlobal || Number.MAX_VALUE;
    const rmseB = b.rmseGlobal || Number.MAX_VALUE;
    return rmseA - rmseB;
  });

  const rankPartRes = [];
  rankedResults.forEach((e, i) => {
    rankPartRes[e.np] = rankPartRes[e.np] || {id: e.np, rank: i+1};
    document.querySelector(`#itemRank-${e.np}-${e.step + 1}`).innerText = `RANK#${i+1}`;
  });

  rankPartRes.forEach((e) => {
    document.querySelector(`#itemRank-${e.id}`).innerText = `RANK#${e.rank}`;
  });
});

function toggleFormState(enable) {
  if (enable === true) {
    formField.classList.remove('visually-hidden');
    resultContainer.classList.add('visually-hidden');

    startBtn.classList.remove('disabled');

    srcCloudField.removeAttribute('disabled');
    tgtCloudField.removeAttribute('disabled');
    npField.removeAttribute('disabled');
    rmseField.removeAttribute('disabled');
    deltaField.removeAttribute('disabled');
    maxDistField.removeAttribute('disabled');

    axisGroup.querySelectorAll('input').forEach((e) => {
      e.removeAttribute('disabled');
    });

    closestTypeGroup.querySelectorAll('input').forEach((e) => {
      e.removeAttribute('disabled');
    });
  } else {
    formField.classList.add('visually-hidden');
    resultContainer.classList.remove('visually-hidden');

    startBtn.classList.add('disabled');

    srcCloudField.setAttribute('disabled', 'disabled');
    tgtCloudField.setAttribute('disabled', 'disabled');
    npField.setAttribute('disabled', 'disabled');
    rmseField.setAttribute('disabled', 'disabled');
    deltaField.setAttribute('disabled', 'disabled');
    maxDistField.setAttribute('disabled', 'disabled');

    axisGroup.querySelectorAll('input').forEach((e) => {
      e.setAttribute('disabled', 'disabled');
    });

    closestTypeGroup.querySelectorAll('input').forEach((e) => {
      e.setAttribute('disabled', 'disabled');
    });
  }
}

function createListNode(id, label, classList) {
  const head = document.createElement('a');
  head.id = `itemHead-${id}`;
  head.classList.add('list-group-item', 'd-flex', 'align-items-center', ...classList);
  head.setAttribute('data-bs-toggle', 'collapse');
  head.setAttribute('href', `#itemBody-${id}`);
  head.setAttribute('role', 'button');
  head.setAttribute('aria-controls', `itemBody-${id}`);

  const icon = document.createElement('i');
  icon.classList.add('fas', 'fa-chevron-right', 'me-2');
  head.append(icon);

  const lbl = document.createElement('span');
  lbl.innerText = label;
  head.append(lbl);

  const rankBadge = document.createElement('span');
  rankBadge.id = `itemRank-${id}`;
  rankBadge.classList.add('badge', 'rounded-pill', 'bg-light', 'text-dark', 'fw-light', 'ms-auto');
  rankBadge.setAttribute('title', 'Posição no rank de RMSE');
  head.append(rankBadge);

  const body = document.createElement('div');
  body.id = `itemBody-${id}`;
  body.classList.add('collapse', 'list-group');

  body.addEventListener('show.bs.collapse', (e) => {
    e.stopPropagation();
    icon.classList.remove('fa-chevron-right');
    icon.classList.add('fa-chevron-down');
  });

  body.addEventListener('hide.bs.collapse', (e) => {
    e.stopPropagation();
    icon.classList.add('fa-chevron-right');
    icon.classList.remove('fa-chevron-down');
  });

  return { head, body };
}

function createListLeaf(label, cloud) {
  const leaf = document.createElement('div');
  leaf.classList.add('list-group-item', 'list-group-item-action', 'd-flex', 'w-100', 'justify-content-between');

  const lblRow = document.createElement('div');
  lblRow.classList.add('row');
  leaf.append(lblRow);

  const lbl = document.createElement('span');
  lbl.innerText = label;
  lblRow.append(lbl);

  const lenLbl = document.createElement('small');
  lenLbl.classList.add('text-muted');
  lenLbl.innerHTML = `<b>Size:</b> ${cloud.numpts} Pts`;
  lblRow.append(lenLbl);

  const addBtn = document.createElement('button');
  addBtn.classList.add('btn', 'rounded-circle');
  addBtn.setAttribute('title', 'Adicionar ao visualizador');
  addBtn.addEventListener('click', () => {
    viewer.addCloud(cloud, label, `hsl(${Math.floor(Math.random() * 360)}, 100%, 50%)`);
  });
  leaf.append(addBtn);

  const icon = document.createElement('i');
  icon.classList.add('fas', 'fa-plus');
  addBtn.append(icon);

  return leaf;
}

function createListDesc(rmse, tm, time) {
  const lg = document.createElement('div');
  lg.classList.add('list-group-item', 'fw-light');

  if (rmse) {
    const rmseRow = document.createElement('div');
    rmseRow.classList.add('row');
    lg.append(rmseRow);

    const rmseLbl = document.createElement('small');
    rmseLbl.classList.add('text-muted');
    rmseLbl.innerHTML = `<b>RMSE:</b> ${rmse}`;
    rmseRow.append(rmseLbl);
  }

  if (time) {
    const timeRow = document.createElement('div');
    timeRow.classList.add('row');
    lg.append(timeRow);

    const timeLbl = document.createElement('small');
    timeLbl.classList.add('text-muted');
    timeLbl.innerHTML = `<b>Execução:</b> ${time}`;
    timeRow.append(timeLbl);
  }

  const tmLblRow = document.createElement('div');
  tmLblRow.classList.add('row');
  lg.append(tmLblRow);

  if (tm) {
    const tmLbl = document.createElement('small');
    tmLbl.classList.add('text-muted');
    tmLbl.innerHTML = '<b>Matriz de Transformação:</b>';
    tmLblRow.append(tmLbl);

    const tmRow = document.createElement('div');
    tmRow.classList.add('row', 'row-cols-4');
    lg.append(tmRow);

    tm.forEach((row) => {
      row.forEach((e) => {
        const col = document.createElement('div');
        col.classList.add('col', 'overflow-hidden');
        tmRow.append(col);

        const eValue = document.createElement('small');
        eValue.classList.add('text-muted');
        eValue.innerHTML = e.re;
        col.append(eValue);
      });
    });
  } else {
    const tmLbl = document.createElement('small');
    tmLbl.classList.add('text-muted');
    tmLbl.innerHTML = '<i>ICP não executado!</i>';
    tmLblRow.append(tmLbl);
  }

  return lg;
}

// // const itm = createListNode(1, 'Item numero '+1, ['bg-primary', 'text-white']);
// // resultBody.append(itm.head, itm.body);
// // itm.body.append('dasdasdasdasdasd')

// for (let index = 1; index < 10; index++) {
//   const itm = createListNode(index, 'Item numero '+index, ['bg-primary', 'text-white']);
//   resultBody.append(itm.head, itm.body);
//   for (let j = 1; j < 10; j++) {
//     const subItm = createListNode(index + '-' + j, 'Item numero '+ index + '-' + j, ['bg-info']);
//     itm.body.append(subItm.head, subItm.body);
//     subItm.body.append('dasdasdasdasdasd');
//   }
// }
