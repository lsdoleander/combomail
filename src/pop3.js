{
  function pop3({ host, port, ssl, username, password }, search) {
    var Client = require('yapople').Client;
    var client = new Client({
      host, port, username, password
      tls: ssl, mailparser: true
    });

    return {
      search(terms){
        return new Promise(resolve=>{
          let output = {};
          client.connect(function() {
            client.retrieveAll(function(err, messages) {
              client.quit();
              for (message of messages){
                for (term of terms) {
                  if (message.subject.contains(term) || message.from.contains(term)){
                    if (output[term]) output[term]++;
                    else output[term] =1;
                  }
                }
              }
              resolve(output);
            })
          })
        })
      }
    }
  }
}