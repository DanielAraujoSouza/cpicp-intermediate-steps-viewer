const socketIo = require('socket.io')
const path = require('path')
const pontu = require('pontu-module')
const cpicp = require('cpicp-module')

async function getCloud(cloudName) {
  const directoryPath = path.join(__dirname, '..', 'clouds', cloudName)
  console.log(directoryPath)
  return pontu.cloud_load(directoryPath)
}

module.exports = (http) => {
  const io = socketIo(http)

  io.on('connection', (socket) => {
    console.log('A user connected')

    socket.on('get-src', async (srcName) => {
      const cloud = await getCloud(srcName)
      socket.emit('res-src', cloud)
      console.log('Src Enviada')
    })

    socket.on('get-tgt', async (tgtName) => {
      console.log(tgtName)
      const cloud = await getCloud(tgtName)
      socket.emit('res-tgt', cloud)
      console.log('Tgt Enviada')
    })

    socket.on('get-cpicp', async (cpicpData) => {
      console.log(cpicpData)
      const [src, tgt] = await Promise.all([
        getCloud(cpicpData.srcName),
        getCloud(cpicpData.tgtName),
      ])

      // Envia nuvens originais
      socket.emit('res-cpicp-clouds', { src, tgt })

      let bestReg = {}
      for (let np = 2; np <= cpicpData.np; np++) {
        const [srcPart, tgtPart] = await Promise.all([
          cpicp.CloudPartitioning(src, np, cpicpData.axis),
          cpicp.CloudPartitioning(tgt, np, cpicpData.axis),
        ])

        console.log('Particionado')

        const stepRes = []
        for (let i = 0; i < np; i++) {
          const startTime = process.hrtime()
          stepRes[i] = {
            np,
            step: i,
          }
          stepRes[i].srcPart = srcPart[i]
          stepRes[i].tgtPart = tgtPart[i]

          const icpRes = await pontu
            .registration_icp(
              srcPart[i],
              tgtPart[i],
              cpicpData.delta,
              cpicpData.k,
              cpicpData.maxDist,
              cpicpData.closestType
            )
            .catch(() => undefined)

          stepRes[i].icpRes = icpRes

          if (icpRes !== undefined) {
            const srcAlgn = await pontu.cloud_transform(src, icpRes.tm)
            console.log('Fim Alinhamento')
            const rmse = await pontu.cloud_rmse(
              srcAlgn,
              tgt,
              cpicpData.maxDist,
              cpicpData.closestType
            )
            console.log('Fim RMSE')
            stepRes[i].rmseGlobal = rmse
            stepRes[i].srcAlgn = srcAlgn

            if (bestReg === undefined || rmse < bestReg.rmse) {
              bestReg = {
                rmse,
                converged: rmse <= cpicpData.rmse,
              }
            }
          }

          if (bestReg.rmse <= cpicpData.rmse) {
            break
          }
          const endTime = process.hrtime(startTime)
          stepRes[i].time = `${endTime[0]}s ${endTime[1] / 1000}ms`
        }
        socket.emit('res-cpicp-partition', stepRes)
        if (bestReg.rmse <= cpicpData.rmse) {
          break
        }
      }
      socket.emit('res-cpicp-done', 'ok')
    })
  })
}
