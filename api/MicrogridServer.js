const express = require("express");
const bodyParser = require("body-parser");
const Kwm = require('./Kwm.js');
const router = express.Router();
const app = express();
const crypto = require("crypto");
const { MongoClient } = require("mongodb");
const JSONWebKey = require( 'json-web-key' );
const { networkInterfaces } = require('os');
var jwkToPem = require('jwk-to-pem');
var responseTime = require('response-time')

const url = "mongodb://127.0.0.1:27017";
const client = new MongoClient(url);
// Base de datos
const dbName = "blockchain";
client.connect();
const db = client.db(dbName);

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
// add router in express app
app.use("/",router);
app.use(responseTime())

// Routes
router.post('/validatorIT', async (req, res) => {

    let segundos = new Date().getSeconds();
    if ( ( ( (segundos) % 5 ) == 0 ) ){
        
        var transaction = req.body.transaction;
        var transactionParsed = JSON.parse(transaction);

        // Public Key
        // console.log(transactionParsed[1][1]['n']);
        let webPK = transactionParsed[1][1];
        // console.log(validateSign(webPK, transactionParsed[1][2]))

        try {
            // Validación de la Firma con la llave pública
            if (validateSign(webPK, transactionParsed[1][2])){

                // Preparamos el hash
                let hash = crypto.createHash('sha256');
                let data = hash.update(transactionParsed[1][1]['n'], 'utf-8');
                // Crea un HASH de 64 bytes para KWM
                let transactionPKHash = data.digest('hex');
                // console.log(transactionPKHash)
                let kwm = new Kwm();
                const validatorKwm = kwm.calculate_kwm(transactionPKHash);

                const ledger = await getLedgerHash();

                insertIntoConsensousTable(generateBlock(transactionParsed[0], transactionPKHash, validatorKwm, webPK, ledger, transactionParsed[1][2]));

                res.end("Medición del peso de la transacción de interés: "+req.socket.bytesRead+" | Latencia en el envío de transacciones de interés: "+req.header("X-Response-Time"));

            } else {
                res.end('Servidor: Máquina no verificada por CA.'); 
            }
        } catch (error){
            console.log(error)
        }

    } else {
        // Respuesta si la transacción de interés llega fuera de Q1
        res.end('Servidor: Transacción fuera de tiempo Q1: revise la sincronización de la hora.');
    }

});

router.post('/ccrReciver', async (req, res) => {

    let segundos = new Date().getSeconds();

    if ( ( ( ( segundos - 2 ) % 5 ) == 0 ) ){

        var ccr = req.body.ccr;
        var ccrParsed = JSON.parse(ccr);

        console.log('');
        console.log('Servidor: Insertando ccr desde: ' + ccrParsed[0] + ' -> a los ' + segundos + ' segundos.');
        console.log('');

        try {
            // console.log('Servidor: Insertando ccr desde: ',ccrParsed[0]);
            // console.log('CCR: ' + ccrParsed);
            insertIntoCCRs(generateBlockCCRs( ccrParsed[0], ccrParsed[1], JSON.stringify(ccrParsed[2])) );
        } catch (error){
            console.log(error);
        }

    } else {
        // Respuesta si la transacción de interés llega fuera de Q3
        res.end('Transacción fuera de tiempo Q3: revise la sincronización de la hora.');
    }

    res.end('Llego.');

});

router.post('/genesisBlockVerification', async (req, res) => {

    console.log('');
    console.log('Servidor: Se recibe bloque Genesis.');
    console.log('');

    let genesis = req.body.genesisBlock;
    let genesisBody = JSON.parse(genesis)['validatorsNTuple'];
    let genesisComparison = await compareGenesis(genesisBody);
    if (genesisComparison[0] == true){
        res.end(JSON.stringify(genesisComparison));
    } else {
        res.end(false);
    }

    // let segundos = new Date().getSeconds();
    // let arraySegundos = Array.from(segundos.toString());

    // if ( ( ( ( ( segundos - 3 ) % 5 ) == 0 ) && ( arraySegundos[arraySegundos.length - 1] != '8' ) ) ){

    //     var transaction = req.body.transaction;
    //     console.log(transaction)
    //     var transactionParsed = JSON.parse(transaction);
    //     var transactionBody = JSON.parse(transactionParsed['body']);
        
    //     if (validateSign(transactionBody['pk'], transactionBody['sign'])){

    //         try {
    //             console.log('Llego desde ' + transactionBody['input'] + ' -> a los ' + segundos + ' segundos.');
    //             console.log('Insertando transaccion VERIFICADA desde: ', transactionBody['input']);
    //             // console.log('Transaccion: ' + transactionParsed);
    //             insertIntoTransactionPool(transactionParsed);
    //         } catch (error){
    //             console.log(error);
    //         }
        
    //     } else {
    //         console.log('Máquina no verificada por CA.')
    //         res.end('Máquina no verificada por CA.');
    //     }

    // } else {
    //     // Respuesta si la transacción de interés llega fuera de Q3
    //     res.end('Transacción fuera de tiempo Q5: revise la sincronización de la hora.');
    // }

});


router.post('/genesisBlockInsert', async (req, res) => {

    console.log('');
    console.log('Servidor: Se recibe bloque Genesis VERIFICADO.');
    console.log('');

    let genesis = req.body.genesisBlock;
    let genesisBody = JSON.parse(genesis);
    await insertGenesis(genesisBody);

    // let segundos = new Date().getSeconds();
    // let arraySegundos = Array.from(segundos.toString());

    // if ( ( ( ( ( segundos - 3 ) % 5 ) == 0 ) && ( arraySegundos[arraySegundos.length - 1] != '8' ) ) ){

    //     var transaction = req.body.transaction;
    //     console.log(transaction)
    //     var transactionParsed = JSON.parse(transaction);
    //     var transactionBody = JSON.parse(transactionParsed['body']);
        
    //     if (validateSign(transactionBody['pk'], transactionBody['sign'])){

    //         try {
    //             console.log('Llego desde ' + transactionBody['input'] + ' -> a los ' + segundos + ' segundos.');
    //             console.log('Insertando transaccion VERIFICADA desde: ', transactionBody['input']);
    //             // console.log('Transaccion: ' + transactionParsed);
    //             insertIntoTransactionPool(transactionParsed);
    //         } catch (error){
    //             console.log(error);
    //         }
        
    //     } else {
    //         console.log('Máquina no verificada por CA.')
    //         res.end('Máquina no verificada por CA.');
    //     }

    // } else {
    //     // Respuesta si la transacción de interés llega fuera de Q3
    //     res.end('Transacción fuera de tiempo Q5: revise la sincronización de la hora.');
    // }

});


router.post('/transactionReciver', async (req, res) => {
    
    let segundos = new Date().getSeconds();
    let arraySegundos = Array.from(segundos.toString());

    if ( ( ( ( ( segundos ) % 5 ) == 0 ) && ( arraySegundos[arraySegundos.length - 1] != '0' ) ) ){

        var transaction = req.body.transaction;
        var transactionParsed = JSON.parse(transaction);
        var transactionBody = JSON.parse(transactionParsed['body']);
        
        if (validateSign(transactionBody['pk'], transactionBody['sign'])){

            try {
                console.log('Servidor: Insertando transaccion VERIFICADA desde: ', transactionBody['input'] + ' -> a los ' + segundos + ' segundos.');
                // console.log('Transaccion: ' + transactionParsed);
                insertIntoTransactionPool(transactionParsed);
            } catch (error){
                console.log(error);
            }
        
        } else {
            console.log('Servidor: Máquina no verificada por CA.')
            res.end('Servidor: Máquina no verificada por CA.');
        }

    } else {
        // Respuesta si la transacción de interés llega fuera de Q3
        res.end('Servidor: Transacción fuera de tiempo Q6: revise la sincronización de la hora.');
    }

    res.end('Llego.');

});

// Valida la firma de una máquina 
function validateSign (webPublickKey, signature){

    // Transformación de public key como jsonWebKey a pem
    let webPem = jwkToPem(webPublickKey);

    const verifiableData = "Validator Interest Transaction";

    // Transformación de signature como string a Buffer
    const buff = Buffer.from(signature, 'base64');

    return isVerified = crypto.verify(
        "sha256",
        Buffer.from(verifiableData),
        {
            key: webPem,
            padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        },
        buff
    );

}

const compareGenesis = async (block) => {
    
    console.log('');
    console.log('*** COMPARACION GENESIS ***');
    console.log('');
    block = JSON.stringify(block);
    // console.log(block);
    
    // Usamos la colección "block"
    const col = db.collection("currentGenesis");

    return new Promise(async (resolve, reject) =>{

        const p = col.findOne().then(async (result) => {
                if (result) {

                    result = JSON.stringify(result['validatorsNTuple']);

                    console.log('-------------------------------------');
                    console.log('-------------------------------------');

                    if (block == result) {
                        console.log('BLOQUE GENESIS DEL LIDER COINCIDE');
                        let res = await signGenesis(result);
                        resolve([true, JSON.stringify(res)]);
                    } else {
                        console.log('BLOQUE GENESIS DEL LIDER DISTINTO');
                        resolve(false);
                    }

                    console.log('-------------------------------------');
                    console.log('-------------------------------------');

                } else {
                    resolve(false);
                }
            });

    }).catch( (err) => {
        // Manejo de error
        console.log(err);
        reject(err);
    });
        
}

const insertGenesis = async (genesis) => {

    console.log('');
    console.log('*** INSERTANDO GENESIS ***');
    console.log('');
    console.log('Bloque genesis: '+genesis);
    console.log('');

    let now = new Date();
    let segundos = now.getSeconds();    

    // Creación del id de la transacción
    // creating hash object 
    let hash = crypto.createHash('sha256');
    // passing the data to be hashed
    let data = hash.update(JSON.stringify(genesis), 'utf-8');
    // Crea un HASH de 64 bytes
    let genesisHash = data.digest('hex');

    // genesis.push({'blockhash': genesisHash});    

    // genesis = Object.assign({3: {blockhash: genesisHash}}, genesis)
    genesis = {
        'blockhash': genesisHash, 
        'fecha': now.getDate()+'/'+(now.getMonth()+1)+'/'+now.getFullYear(), 
        'hora': now.getHours() + ":" + now.getMinutes() + ":" + segundos, 
        'genesis': genesis};
    
    // Usamos la colección "genesis"
    const col = db.collection("genesis");

    // Insertamos un documento para leerlo a continuación
    const p = col.insertOne(genesis, { 'w': 0 }, async (error, docsInserted) => {

        if (error) {
            console.log('Error occurred while inserting: ' + error);
        } else {
            console.log('Documento Genesis insertado Q5.');

            const col_lastUpdate = db.collection("lastUpdate");

            const p_lastUpdate = await col_lastUpdate.updateOne(
                {}, 
                { 
                    $set: {
                        last_block: genesis
                    } 
                },
                { upsert: true }
            ).then( items => {
                console.log('Insertado LASTUPDATE.');
            });
        }

    });    
        
}

const signGenesis = async (genesis) => {

    // Ocupamos una promesa para un trabajo asyncrono
    return new Promise((resolve, reject) => {
        let self = this;
        generateKeyPair().then( (keys) => {

            const publicKey = keys[0], privateKey  = keys[1];
            const verifiableData = genesis;
            const signature = crypto.sign("sha256", Buffer.from(verifiableData), {
                key: privateKey,
                padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
                passphrase: "microgrid"
            });

            // Uso de una key pública como JSONWebKey, es decir un objeto JSON
            const webPublicKey = JSONWebKey.fromPEM(publicKey).toJSON();
            // Constenido de la transacción
            const transactionContent = [webPublicKey, signature.toString("base64")];
            
            let epochWebPk = webPublicKey;
            let epochSignature = signature.toString("base64");

            resolve([obtainIp(), epochWebPk, epochSignature]);

        }).catch( (err) => {
            // Manejo de error
            console.log(err);
            reject(err);
        });
    })

}

const generateKeyPair = () => {

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

const insertIntoConsensousTable = async ( kwmRow ) => {

    // Usamos la colección "block"
    const col = db.collection("ccr");   
    
    // Insertamos un documento para leerlo a continuación
    const p = col.insertOne(kwmRow, {'w': 0}, function(error, docsInserted){

        if(error) {
            console.log('Error occurred while inserting: '+error);
        } else {
            console.log('Documento insertado Q1: ' + JSON.stringify(docsInserted));
        }

    });

}

// Inserta en BD los ccr que vienen de los validadores 
const insertIntoCCRs = async ( ccr ) => {

    // Usamos la colección "block"
    col = db.collection("validatorsCCRs");
    
    // Insertamos un documento para leerlo a continuación
    const p = col.insertOne(ccr, {'w': 0}, function(error, docsInserted){

        if(error) {
            console.log('Error occurred while inserting: '+error);
        } else {
            console.log('Documento insertado Q3: ' + JSON.stringify(docsInserted));
        }

    });

}

// Inserta en BD los ccr que vienen de los validadores 
const insertIntoTransactionPool = async ( transaction ) => {

    // Usamos la colección "block"
    col = db.collection("transactionPool");
    
    // Insertamos un documento para leerlo a continuación
    const p = col.insertOne(transaction, {'w': 0}, function(error, docsInserted){

        if(error) {
            console.log('Error occurred while inserting: '+error);
        } else {
            console.log('Documento insertado Q6: ' + JSON.stringify(docsInserted));
        }

    });

}

// Función que construye un bloque de la cadena
const generateBlock = (id, pk, kwm, webPk, ledger, sign) => {
    
    const ccr = 0;

    // Construcción del documento                                                                                                                                                              
    let block = {
        "ip": id,
        "pk": pk,                                                                                                                                 
        "kwm": kwm, 
        "ccr": ccr,
        'webPk': webPk,
        'ledger': ledger,
        'sign': sign
    }

    return block;
}

// Función que construye un bloque de la cadena
const getLedgerHash = async () => {
    
    return new Promise(async (resolve, reject) => {

        // Usamos la colección "block"
        const col = db.collection("ledger");

        // Buscamos los documentos para leerlo a continuación
        const p = col.find({},{projection:{ _id: 0 }}).toArray(function(err, result) {
            
            if (err) throw err;
            
            console.log(result);

            // if (result.length == 0){
            //     resolve(0);
            //     // console.log('No existe coleccion!');
            // }
            
            resolve(0);

        });

    }).catch( (err) => {
        // Manejo de error
        console.log(err);
        reject(err);
    });
    
}

// Función que construye un bloque de la cadena
function generateBlockCCRs(id, validators, ccr){

    // Construcción del documento                                                                                                                                                              
    let block = {
        "ip": id,
        "validators": validators,                                                                                                                                 
        "kwm": ccr, 
    }

    return block;
}

const obtainIp = () => {

    'use strict';
    const nets = networkInterfaces();
    const results = Object.create(null); // Or just '{}', an empty object
    let arr = new Array();

    for (const name of Object.keys(nets)) {
        
        for (const net of nets[name]) {
            // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
            if (net.family === 'IPv4' && !net.internal) {
                if (!results[name]) {
                    results[name] = [];
                }
                results[name].push(net.address);
                arr.push(net.address);
            }
        }
        
    }

    return arr[2];

}

app.listen(3000, async () => {
    console.log("Started on PORT 3000");
});