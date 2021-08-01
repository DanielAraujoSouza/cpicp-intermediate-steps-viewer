const fs = require('fs')
const path = require('path')
const router = require('express').Router()

const { readdir } = require('fs').promises

async function getFiles(dir) {
  const files = []
  const promisesPool = []
  const ext = ['.json', '.csv', '.pcd', '.ply', '.xyz', '.obj']

  const dirents = await readdir(dir, { withFileTypes: true })

  dirents.forEach((e) => {
    const filePath = `${dir}/${e.name}`
    console.log('fp: ', filePath)
    console.log('ext ', path.extname(e.name))
    if (e.isDirectory()) {
      promisesPool.push(getFiles(filePath))
    } else if (ext.includes(path.extname(e.name).toLowerCase())) {
      console.log(e)
      files.push(filePath.replace('./clouds/', ''))
    }
  })

  await Promise.all(promisesPool).then((results) => {
    files.push(...results.flat(Infinity))
  })

  return files
}

/* GET home page. */
router.get('/', async (req, res, next) => {
  const files = await getFiles('./clouds')
  res.render('index', { clouds: files })
})

module.exports = router
