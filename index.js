const express = require('express');
const fileUpload = require('express-fileupload');
const ejs = require('ejs');
const bodyParser = require('body-parser')
const { QuickDB } = require("quick.db");
const cookieParser = require('cookie-parser');
const art = require('express-art-template')
const methodOverride = require('method-override')
const fs = require('fs')

var pass = '8746'
var tpass = '2222'

const app = express();
const db = new QuickDB();

app.use(cookieParser(pass));
app.use(fileUpload());
app.use(bodyParser.urlencoded({ extended: true }))
app.use(methodOverride('_method'))

app.use('/public', express.static('public'));
app.engine('ejs', art);
app.set('view engine', 'ejs');

app.get('/setup', async (req, res) => {
  res.send(await db.get('articles'))
})

app.get('/', async (req, res) => {
  let articles = await db.get("articles") || [];
  let admin = req.signedCookies.admin == pass
  var teacher = req.signedCookies.teacher == tpass
  var page = 'index'
  res.render('index', { articles, admin, teacher, page });
});

app.get('/article/:id', async (req, res) => {
  let admin = req.signedCookies.admin == pass
  let teacher = req.signedCookies.teacher == tpass
  
  let articles = await db.get("articles") || [];
  let id = req.params.id;
  let article = articles.find(r => r.id == id)
  if (!article) {
    article = (await db.get('teachers') || []).find(r => r.id == id)
    if (!article) {
      res.status(404).render('404')
      return;
    }
    if (!teacher || !admin) {
      res.redirect('/teachers')
      return;
    } 
  }
  res.render('article', {
    article,
    admin
  });
});

app.get('/teachers', async (req, res) => {
  var teacher = req.signedCookies.teacher == tpass
  var admin = req.signedCookies.admin == pass
  if (teacher || admin) {
    let articles = await db.get("teachers") || [];
    var page = 'teacher'
    res.render('index', { articles, teacher, page });
  } else {
    res.render('auth.ejs')
  }
})

app.get('/logout', (req, res) => {
  res.clearCookie('teacher')
  res.clearCookie('admin')
  res.redirect('back')
})
    
app.get('/staff', async (req, res) => {
  let teacher = req.signedCookies.teacher == tpass
  let admin = req.signedCookies.admin == pass
    
  if (teacher) {
    res.redirect('/teachers')
  } else if (admin) {
    res.redirect('/add')
  } else {
    res.render('auth.ejs')
  }
})

app.post('/auth', async (req, res) => {
  if (req.body.pass == pass) {
    res.cookie('admin', req.body.pass, { signed: true })
    res.redirect('/add')
  } else if (req.body.pass == tpass) {
    res.cookie('teacher', req.body.pass, { signed: true })
    res.redirect('/teachers')
  } else {
    res.redirect('/');
  }
})

app.get('/add', (req, res) => {
  if (req.signedCookies.admin == pass) {
    res.render('add.ejs')
  } else {
    res.render('auth.ejs')
  }
});

app.post('/add', async (req, res) => {
  if (req.signedCookies.admin != pass) return res.render('404')
  if (!req.files) return res.send('No image found')
  const { image } = req.files;
  image.mv(__dirname + '/public/' + image.name);
  if (req.files.pdf) req.files.pdf.mv(__dirname + '/public/pdfs/' + req.files.pdf.name)
  var arcs = await db.get('articles')||[]
  var id = 1
  if (arcs.length > 0) id = arcs[arcs.length - 1].id + 1
  let newArticle = {
    id: id,
    title: req.body.title,
    content: req.body.content,
    pdf: req.files.pdf ? '/public/pdfs/' + req.files.pdf.name : null,
    cover: '/public/' + image.name
  };
  await db.push(req.body.teacher ? "teachers" : "articles", newArticle);
  res.redirect('/');
});

app.delete('/del/:id', async (req, res) => {
  if (req.signedCookies.admin != pass) return
  let id = req.params.id;
  let articles = await db.get('articles') || []
  let article = articles.find(r=> r.id == id)
  fs.unlinkSync(__dirname + article.cover)
  let index = articles.indexOf(article)
  if (index > -1) articles.splice(index, 1); 
  await db.set("articles", articles);
  res.send('done')
});

app.get("*", (req, res) => {
    res.status(404).render("404", {});
});

app.listen(3000, () => {
  console.log('Server started on http://localhost:3000');
});

