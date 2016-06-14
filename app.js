require('dotenv').config();

var request = require('request'),
    searchEndpoint = process.env.GOOGLE_ENDPOINT,
    mongoClient = require('mongodb').MongoClient,
    express = require('express'),
    app = express(),
    path = require('path');

//homepage is about page
app.get('/', function(req, res) {
   res.sendFile(path.join(__dirname, 'pages', 'about.html'));
});


app.get('/search', function(req, res, next) {
    if (!req.query.q) {
        res.json({"error": "search query is required"});
        return;
    }
    
    var searchOptions = {
        key: process.env.API_KEY,
        
        //kind of google id
        cx: process.env.CX,
        
        searchType: 'image',
        q: req.query.q,
    };
    
    if (req.query.offset && req.query.offset !== '0' 
        && !isNaN(parseInt(req.query.offset))) 
            searchOptions.start = req.query.offset;
    
    //fetching images from google 
    request({ url: searchEndpoint, qs :searchOptions }, function(err, response, body) {
        if(err) return next(err); 
        body = JSON.parse(body);
  
        var result = body.items.map(function(item){
            return {
                url: item.link,
                snippet: item.snippet,
                thumbnail: item.image.thumbnailLink,
                context: item.image.contextLink
            };
        });
        res.json(result);
    });
    
    //saving query to the db
    mongoClient.connect(process.env.MONGO_URI, function(err, db) {
        
        if (err) return next(err);
        
        db.collection('queries_log')
          .insertOne({
             'query': searchOptions.q,
             'when' : Date()
          }, function(err, resp) {
              db.close();
              if (err) return next(err);
          });
    });
});

app.get('/latest', function(req, res, next) {
    mongoClient.connect(process.env.MONGO_URI, function(err, db) {
        
        if (err) return next(err);
        
        db.collection('queries_log')
          .find()
          .project({_id: 0, query: 1, when:1})
          .sort({when: -1})
          .limit(+process.env.DB_LIMIT)
          .toArray(function(err, data){
             db.close();
             if (err) return next(err);
             res.json(data);
          });
    });
});

//404 for any other page
app.use(function(req, res) {
    res.status(404);
    res.sendFile(path.join(__dirname, 'pages', 'notfound.html'));
});

//500 if error occurs
app.use(function(err, req, res, next){
    console.error(err.stack);
    res.type('text/plain');
    res.status(500);
    res.send('500 - Server Error');
});

app.listen(process.env.PORT || 8080, function(){
    console.log( 'I.S.A.L. started at port ' +
    process.env.PORT + '; press Ctrl-C to terminate.' );
});