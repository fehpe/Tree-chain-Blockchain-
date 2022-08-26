const crypto = require("crypto");
const JSONWebKey = require( 'json-web-key' );

class TransactionManager{

    epochWebPk = '';

    epochSignature = '';

    constructor(){
    } 

    generateValidatorInterestTransaction = async () => {

        // Ocupamos una promesa para un trabajo asyncrono
        return new Promise((resolve, reject) => {
            let self = this;
            self.generateKeyPair().then( (keys) => {

                const publicKey = keys[0], privateKey  = keys[1];
                const verifiableData = "Validator Interest Transaction";
                const signature = crypto.sign("sha256", Buffer.from(verifiableData), {
                    key: privateKey,
                    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
                    passphrase: "microgrid"
                });

                // Uso de una key pública como JSONWebKey, es decir un objeto JSON
                const webPublicKey = JSONWebKey.fromPEM(publicKey).toJSON();
                // Constenido de la transacción
                const transactionContent = [webPublicKey, signature.toString("base64")];
                
                self.epochWebPk = webPublicKey;
                self.epochSignature = signature.toString("base64");

                // Creación del id de la transacción
                //creating hash object 
                let hash = crypto.createHash('sha256');
                //passing the data to be hashed
                let data = hash.update(JSON.stringify(transactionContent), 'utf-8');
                // Crea un HASH de 64 bytes
                let transactionId = data.digest('hex');

                // Generación de la transacción de interés de un Validador
                // Se le entrega: < id de la transacción , public key , sign >
                const validatorInterestTransaction = [transactionId, webPublicKey, signature.toString("base64")];
                resolve(validatorInterestTransaction);

            }).catch( (err) => {
                // Manejo de error
                console.log(err);
                reject(err);
            });
        })

    }

    async generateKeyPair(){

        // console.log("Generating Key pair...")

        // Ocupamos una promesa para un trabajo asyncrono
        return new Promise((resolve, reject) => {
            crypto.generateKeyPair('rsa', {
                // La longitud estandar segura para las llaves RSA es 2048 bits
                modulusLength: 2048,
                publicKeyEncoding: {
                  type: 'spki',
                  format: 'pem'
                },
                privateKeyEncoding: {
                  type: 'pkcs8',
                  format: 'pem',
                  cipher: 'aes-256-cbc',
                  passphrase: 'microgrid'
                }
            }, (err, publicKey, privateKey) => {
                // Retornamos las keys si no existe error
                resolve([publicKey, privateKey]);
            });
        })

    }

    calculate_kwm(pk){
        
        let self = this;
        let total_weight = 0;
        const pk_characters = pk.split("");

        pk_characters.forEach(function (character, index) {

            let weight = self.calculate_weight_of(character);
            total_weight = total_weight + weight;

        });

        return total_weight;
    }

    makeNormalTransaction = (input, output, amount, sendDate, sendTime, pk, sign) => {

        let unfinishedTransaction = JSON.stringify({
            'input': input,
            'output': output,
            'amount': amount,
            'sendDate': sendDate,
            'sendTime': sendTime,
            'pk': pk,
            'sign': sign,
        });    

        //creating hash object 
        let hash = crypto.createHash('sha256');
        //passing the data to be hashed
        let data = hash.update(unfinishedTransaction, 'utf-8');
        // Crea un HASH de 64 bytes
        let transactionId = data.digest('hex');    
        
        // Retornamos transaccion comom objeto java
        return {'id': transactionId, 'body': unfinishedTransaction}
        
    }

}
  
module.exports = TransactionManager;