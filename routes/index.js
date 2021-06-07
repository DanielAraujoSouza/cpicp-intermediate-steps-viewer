const fs = require('fs')
const path = require('path')
const router = require('express').Router()

/* GET home page. */
router.get('/', (req, res, next) => {
  const directoryPath = path.join(__dirname, '..', 'clouds')
  fs.readdir(directoryPath, (err, files) => {
    // handling error
    if (err) {
      next(err)
    }
    res.render('index', { clouds: files })
  })
})

router.get('/teste', (req, res, next) => {
  res.render('teste')
})

module.exports = router
