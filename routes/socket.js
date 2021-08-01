const socketIo = require('socket.io')
const path = require('path')
const pontu = require('pontu-module')
const cpicp = require('cpicp-module')

async function getCloud(cloudName) {
  const directoryPath = path.join(__dirname, '..', 'clouds', cloudName)
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
      for (let np = 2; np <= cpicpData.np; np += 1) {
        const [srcPart, tgtPart] = await Promise.all([
          cpicp.CloudPartitioning(src, np, cpicpData.axis),
          cpicp.CloudPartitioning(tgt, np, cpicpData.axis),
        ])

        console.log('Particionado')

        const stepRes = []
        for (let i = 0; i < np; i += 1) {
          const startTime = process.hrtime.bigint()
          stepRes[i] = {
            np,
            step: i,
          }
          stepRes[i].srcPart = srcPart[i]
          stepRes[i].tgtPart = tgtPart[i]

          const icpRes = pontu.registration_icp_sync(
            srcPart[i],
            tgtPart[i],
            cpicpData.delta,
            cpicpData.k,
            cpicpData.maxDist,
            cpicpData.closestType
          )

          stepRes[i].icpRes = icpRes

          if (icpRes !== null) {
            const srcAlgn = pontu.cloud_transform_sync(src, icpRes.tm)
            const rmse = pontu.cloud_rmse_sync(
              srcAlgn,
              tgt,
              cpicpData.maxDist,
              cpicpData.closestType
            )
            stepRes[i].rmseGlobal = rmse
            stepRes[i].srcAlgn = srcAlgn

            if (bestReg.rmse === undefined || rmse < bestReg.rmse) {
              bestReg = {
                rmse,
                converged: rmse <= cpicpData.rmse,
              }
            }
          }

          if (bestReg.rmse <= cpicpData.rmse) {
            break
          }
          const endTime = process.hrtime.bigint()
          const totalTime = Number(endTime - startTime) / 10 ** 6
          stepRes[i].time = `${totalTime} ms`
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
