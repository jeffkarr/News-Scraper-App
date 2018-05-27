var express = require("express");
var bodyParser = require("body-parser");
var logger = require("morgan");
var mongoose = require("mongoose");
var axios = require("axios");
var cheerio = require("cheerio");
var db = require("./models");

var PORT = 3000;

var app = express();
// Configure middleware
//===================================================================================================
// Use morgan logger for logging requests
app.use(logger("dev"));
// Use body-parser for handling form submissions
app.use(bodyParser.urlencoded({ extended: true }));
// Use express.static to serve the public folder as a static directory
app.use(express.static("public"));

// Connect to the Mongo DB
//===================================================================================================
mongoose.connect("mongodb://localhost/newsScraper");

// Routes
//===================================================================================================
// A GET route for scraping the bloomberg website
app.get("/scrape", function (req, res) {
  axios.get("http://www.bloomberg.com/").then(function (response) {
    var $ = cheerio.load(response.data);

    $("article h3").each(function (i, element) {
      var result = {};
      result.title = $(this)
        .children("a")
        .text();
      result.link = "https://www.bloomberg.com" + $(this)
        .children("a")
        .attr("href");
      result.summary = $(this)
        .next()
        .text();

      var titleSliced = result.title.slice(17);
      var titleSlicedAndTrimmed = titleSliced.trim();  
      console.log("titleSlicedAndTrimmed is" + titleSlicedAndTrimmed);
      result.title = titleSlicedAndTrimmed;
      // check to see if scraped summary has any content in it. 
      var str = result.summary;
      var str_esc = escape(str);
      var subStrEsc = str_esc.substr(0,69);
      
      const summaryPretext = "%0A%20%20%20%20%20%20%20%20%20%20%20%20%0A%20%20%20%20%20%20%20%20%0A";
      if (subStrEsc === summaryPretext) {
        result.summary = "Article summary was not found."
      } 
      // Create a new Article using the `result` object built from scraping
      db.Article.create(result)
        .then(function (dbArticle) {
      })
        .catch(function (err) {
          // If an error occurred, send it to the client
          return res.json(err);
        });
    });

    res.send("Scrape Complete");
  });
});

// Route for getting all Articles from the db
app.get("/articles", function (req, res) {
  // Grab every document in the Articles collection
  db.Article.find({})
    .then(function (dbArticle) {
      res.json(dbArticle);
    })
    .catch(function (err) {
      res.json(err);
    });
});

// Route for grabbing a specific Article by id, populate it with it's note
app.get("/articles/:id", function (req, res) {
  // Using the id passed in the id parameter, prepare a query that finds the matching one in our db...
  db.Article.findOne({ _id: req.params.id })
    // ..and populate all of the notes associated with it
    .populate("Note")
    .then(function (dbArticle) {
      // If we were able to successfully find an Article with the given id, send it back to the client
      res.json(dbArticle);
    })
    .catch(function (err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

// Route for getting the Note from the db
app.get("/note/:id", function (req, res) {
 
  db.Note.findOne({ _id: req.params.id })
    .then(function (dbNote) {
      console.log(dbNote);
      res.json(dbNote);
    })
    .catch(function (err) {
      res.json(err);
    });
});


// Route for saving/updating an Article's associated Note
app.post("/articles/:id", function (req, res) {
  // Create a new note and pass the req.body to the entry
  console.log("req.params.id is " + req.params.id);
  console.log("req.body is " + req.body);
  db.Note.create(req.body)
    .then(function (dbNote) {
      console.log("dbNote is " + dbNote);
      res.json(dbNote);
      // If a Note was created successfully, find one Article with an `_id` equal to `req.params.id`. Update the Article to be associated with the new Note
      // { new: true } tells the query that we want it to return the updated User -- it returns the original by default
      // Since our mongoose query returns a promise, we can chain another `.then` which receives the result of the query
      return db.Article.findOneAndUpdate({ _id: req.params.id }, { note: dbNote._id }, { new: true });
    })
    .then(function (dbArticle) {
      console.log("dbArticle is " + dbArticle);
      // If we were able to successfully update an Article, send it back to the client
      res.json(dbArticle);
    })
    .catch(function (err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

// Start the server
app.listen(PORT, function () {
  console.log("App running on port " + PORT + "!");
});
