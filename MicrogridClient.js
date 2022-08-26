const TransactionManager = require('./TransactionManager.js');
const { networkInterfaces } = require('os');
const axios = require("axios");
const { MongoClient, CURSOR_FLAGS } = require("mongodb");
const { MerkleTree } = require('merkletreejs')
const SHA256 = require('crypto-js/sha256')
const { performance } = require('perf_hooks');

class ITSender{

    weights =  {"0": 0,  "1": 1,  "2": 2,  "3": 3,  "4": 4,  "5": 5,  "6": 6,  "7": 7,  "8": 8,  "9": 9,
                "A": 10, "B": 11, "C": 12, "D": 13, "E": 14, "F": 15, "G": 16, "H": 17, "I": 18, "J": 19, 
                "K": 20, "L": 21, "M": 22, "N": 23, "O": 24, "P": 25, "Q": 26, "R": 27, "S": 28, "T": 29, 
                "U": 30, "V": 31, "W": 32, "X": 33, "Y": 34, "Z": 35,
                "a": 36, "b": 37, "c": 38, "d": 39, "e": 40, "f": 41, "g": 42, "h": 43, "i": 44, "j": 45, 
                "k": 46, "l": 47, "m": 48, "n": 49, "o": 50, "p": 51, "q": 52, "r": 53, "s": 54, "t": 55, 
                "u": 56, "v": 57, "w": 58, "x": 59, "y": 60, "z": 61};

    calculatedConsensousTable = {};

    validatorCounter = 0;

    ccrFinal = {};

    byzantineNumber = 66;

    // Comparar con nuevos validadores para ver si alguno falta
    lastValidators = [];

    timings = {
        // use process.hrtime() as it's not a subject of clock drift
        startAt: process.hrtime(),
        dnsLookupAt: undefined,
        tcpConnectionAt: undefined,
        tlsHandshakeAt: undefined,
        firstByteAt: undefined,
        endAt: undefined
    }

    // Santiago
    // hosts = ['192.168.1.111','192.168.1.173','192.168.1.174','192.168.1.139'];
    // Curico
    hosts = ['192.168.0.14','192.168.0.15','192.168.0.16'];

    constructor(){
        this.transactionManager = new TransactionManager();
        this.machineIP = this.obtainIp();
        // For fresh start 
        this.clearDb();
        // this.mongoClient = new MongoClient("mongodb://127.0.0.1:27017").connect();
        // this.mongoClient.connect();
        this.main();
    }
    
    main = async () => {

        let self = this;

        let one_time = true;
        let one_time_Q2 = true;
        let one_time_Q3 = true;
        let one_time_Q4 = true;
        let one_time_Q5 = true;
        let one_time_Q6 = true;
        let one_time_Q7 = true;
        let started = false;
        let ccr = '';
        let generatedGenesis = '';
       
        while (true){

            let now = new Date();
            let segundos = now.getSeconds();
            let arraySegundos = Array.from(segundos.toString());

             // Q1

            if ( (segundos % 10) == 0 && one_time){
                self.printQ(1,segundos);
                console.log("Entra a 5 seg: "+segundos+".  -> Q1.");
                // Se reinicia la tabla de consenso de cada nodo
                self.calculatedConsensousTable = {};
                self.validatorCounter = 0;
                // Se genera la Validator Interest Transaction
                await self.sendTransaction(await self.makeTransaction());
                // Se limpia pool de transacciones 
                self.clearTransactions();
                one_time = false;
                started = true;
            } else {
                if ( !((segundos % 5) == 0) ){
                    one_time = true;
                }
            }

            // Q2

            if ( (((segundos-1) % 5) == 0) && one_time_Q2 && started && ( arraySegundos[arraySegundos.length - 1] != '6' )){
                self.printQ(2,segundos);
                console.log("Entra a 5+1 seg: "+segundos+". -> Q2.");
                if (await self.ccrExists()){
                    let consensousTable = await self.getLeadersIT();
                    // console.log('VERIFICAR SI SIRVE ????????? :');
                    await self.clearLeadersIT();
                    self.calculateConsensousTable(consensousTable);
                    // Sirve para la generacion del bloque genesis
                    console.log(self.calculatedConsensousTable);
                }                
                one_time_Q2 = false;
            } else {
                if ( !(((segundos-1) % 5) == 0) ){
                    one_time_Q2 = true;
                }
            }

            // Q3

            if ( (((segundos-2) % 5) == 0) && one_time_Q3 && started){
                self.printQ(3,segundos);
                console.log("Entra a 5+2 seg: "+segundos+". -> Q3.");
                // Limpieza de coleccion de genesis actual para actualizacion de genesis en Q4
                self.clearGenesis();
                if ( ( self.calculatedConsensousTable != {} ) && ( self.validatorCounter > 2 ) ){
                    console.log('Entra al envio de la tabla de consenso a los otros nodos Q3.');
                    await self.sendCalculatedConsensousTable();
                } else {
                    if (self.validatorCounter <= 2){
                        console.log('Muy pocos validadores. Error Q3.')
                    } else {
                        console.log('No existe ccr. Error. Error Q3.');
                    }
                }               
                one_time_Q3 = false;
            } else {
                if ( !(((segundos-2) % 5) == 0) ){
                    one_time_Q3 = true;
                }
            }

            // Q4

            if ( (((segundos-3) % 5) == 0) && one_time_Q4 && started){

                self.printQ(4,segundos);
                console.log("Entra a 5+3 seg: "+segundos+". -> Q4.");

                if ( ( self.validatorCounter > 2 ) ){
                    console.log('Entra a la resolucion de inconsistencias Q4.');
                    let ccrs = await self.getCCRs();
                    await self.resolveAnyInconsistency(ccrs);
                    console.log(self.ccrFinal);
                    // Vemos si el nodo es el validador lider
                    ccr = JSON.parse(JSON.parse(self.ccrFinal['ccr']));
                    generatedGenesis = self.generateGenesis(ccr);
                    // Se guarda bloque genesis en bd para comparar con el del validador lider del periodo
                    await self.saveGenesis(generatedGenesis);                    
                } else {
                    console.log('Muy pocos validadores. Error Q4.')
                }

                one_time_Q4 = false;

            } else {
                if ( !(((segundos-3) % 5) == 0) ){
                    one_time_Q4 = true;
                }
            }

            // Q5
            // Se envia el bloque genesis

            if ( (((segundos-4) % 5) == 0) && one_time_Q5 && started){

                self.printQ(5,segundos);
                console.log("Entra a 5+4 seg: "+segundos+". -> Q5.");   

                if (self.machineIP == ccr[0]['ip']){
                    // generateGenesis(ccr) genera el bloque genesis, luego sendSignedGenesis lo envia firmado por el nodo actual hacia la red
                    self.printGenesisAd();
                    if (self.validateSignedGenesis(await self.sendSignedGenesis(generatedGenesis), generatedGenesis) ){
                        self.sendSettledGenesis(generatedGenesis);
                    }
                }
                await self.clearCCRs();
                           
                one_time_Q5 = false;

            } else {
                if ( !(((segundos-4) % 5) == 0) ){
                    one_time_Q5 = true;
                }
            }
            
            // Q6
            // Se envian las transacciones si es necesario

            if ( (((segundos) % 5) == 0) && one_time_Q6 && started && ( arraySegundos[arraySegundos.length - 1] != '0' )){

                self.printQ(6,segundos);
                console.log("Entra a 5+5 seg: "+segundos+". -> Q6.");   

                let filteredHosts = self.hosts.filter( function (ipValue){
                    return ipValue != self.machineIP;
                });

                // Simulación de transacciones, en donde el nodo actual es input, osea recibe una cantidad de energia
                if (self.getRandomInt(3) == 0){
                    let transaction = self.transactionManager.makeNormalTransaction(
                        self.machineIP,
                        filteredHosts[self.getRandomInt(2)],
                        self.getRandomInt(2000),
                        now.getDate()+'/'+(now.getMonth()+1)+'/'+now.getFullYear(),
                        now.getHours() + ":" + now.getMinutes() + ":" + segundos,
                        self.transactionManager.epochWebPk, 
                        self.transactionManager.epochSignature
                    );
                    console.log('Cliente: Envio de transaccion.');
                    console.log(transaction);
                    await self.insertIntoTransactionHistory(transaction);
                    await self.sendNormalTransaction(transaction);
                }
                           
                one_time_Q6 = false;

            } else {
                if ( !(((segundos-5) % 5) == 0) ){
                    one_time_Q6 = true;
                }
            }

            // Q7
            // Append transacciones a Ledger que se encuentren en el rango del validador.

            if ( (((segundos-1) % 5) == 0) && one_time_Q7 && started && ( arraySegundos[arraySegundos.length - 1] != '1' )){

                self.printQ(7, segundos);
                console.log("Entra a 5+6 seg: "+segundos+". -> Q7.");   

                console.log('Append transacciones a Ledger.');

                let epochGenesis = await self.getCurrentGenesis();
                // console.log('EPOCH GENESIS:::: '+epochGenesis["last_block"]["blockhash"]);
                let transactions = await self.getTransactions();
                // console.log('TRANS:::: '+JSON.stringify(transactions))
                
                let block = await self.generateBlock(epochGenesis["last_block"], transactions);
                if ( block ){
                    await self.insertIntoLedger(block);
                }
                           
                one_time_Q7 = false;
                started = false;

            } else {
                if ( !(((segundos-1) % 5) == 0) ){
                    one_time_Q7 = true;
                }
            }

        }

    }

    obtainIp = () => {

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

    makeTransaction = async () => {

        let self = this;
        let interestTransaction = Array();
        let ip = self.obtainIp();
        let unfinishedInterestTransaction = await this.transactionManager.generateValidatorInterestTransaction();
        interestTransaction = [ip,unfinishedInterestTransaction];
        return JSON.stringify(interestTransaction);
        // console.log("Fin proceso generacion Validador IT !!!!!");

    }

    sendTransaction = async (interestTransaction) => {

        console.log('Enviando transaccion de interes.');

        let self = this;
        let promises = Array();

        return new Promise((resolve, reject) =>{

            self.hosts.forEach( element => {

                let time = performance.now();

                // Envio a cada host, se trabaja como una promesa para tener una medida sobre el resultado de cada envío
                let promise = new Promise((resolve_host, reject_host) => {

                    

                    // Post de axios hacia el puerto 3000 de cada host, hacia el archivo validatorIT
                    axios.post(`http://${element}:3000/validatorIT`, {
                            transaction: interestTransaction,
                        }).then(function(response) {
                            // console.log("BIEN")
                            // console.log("Respuesta: "+response.responseTime);
                            console.log(`${(performance.now() - time) / 1000} seconds`);
                            resolve_host(response.data);
                        }).catch(function(error) {
                            // console.log("Error: "+error);
                            reject_host(error);
                        })  
                    
                }).catch( (err) => {
                    // Manejo de error
                    // console.log(err);
                    reject_host(err);
                });
    
                promises.push(promise);
    
            });
    
            // Se hace uso de allSettled, método que permite manejar múltiples promesas simultaneamente, las cuales pueden ser independientes de las otroas
            Promise.allSettled(promises)
            .then((result) => {
                console.log(result);
                console.log("Promesas Q1 cumplidas");
                resolve(result)
            });

        }).catch( (err) => {
            // Manejo de error
            console.log(err);
            reject(err);
        });
        
    }

    getLeadersIT = async() => {

        return new Promise(async (resolve, reject) => {
    
            const url = "mongodb://127.0.0.1:27017";
            const client = new MongoClient(url);
            // Base de datos
            const dbName = "blockchain";
            await client.connect();    
            const db = client.db(dbName);
            // Usamos la colección "block"
            const col = db.collection("ccr");
            
            // Buscamos los documentos para leerlo a continuación
            const p = col.find({},{projection:{ _id: 0 }}).toArray(function(err, result) {
                if (err) throw err;
                // console.log(result);
                client.close();
                resolve(result);
            });
    
        }).catch( (err) => {
            // Manejo de error
            console.log(err);
            reject(err);
        });
        
    }

    clearLeadersIT = async () => {

        return new Promise(async (resolve, reject) => {
    
            const url = "mongodb://127.0.0.1:27017";
            const client = new MongoClient(url);
            // Base de datos
            const dbName = "blockchain";
            await client.connect();    
            const db = client.db(dbName);
            // Usamos la colección "block"
            const col = db.collection("ccr");
            
            // Se limpia collecion ccr
            const p = col.drop(function(err, delOK) {
                if (err) throw err;
                if (delOK) console.log("Validators IT cleared (ccr collection cleared).");
                client.close();
                resolve(delOK);
            });
    
        }).catch( (err) => {
            // Manejo de error
            console.log(err);
            reject(err);
        });
        
    }

    ccrExists = async () => {

        return new Promise(async (resolve, reject) => {
    
            const url = "mongodb://127.0.0.1:27017";
            const client = new MongoClient(url);
            // Base de datos
            const dbName = "blockchain";
            let ccrExists = false;
            client.connect(async function (err) {    
                console.log("Connected successfully to server");
                const collection = await (await client.db(dbName).listCollections({}, { nameOnly: true }).toArray()).forEach(element => {
                    if (element['name'] == 'ccr'){
                        ccrExists = true;
                        // console.log("Existe");
                        
                    } else {
                        // console.log("No");  
                    }
                    client.close();                
                });
                resolve(ccrExists);
            });
    
        }).catch( (err) => {
            // Manejo de error
            console.log(err);
            reject(err);
        });;
        
    }

    calculateConsensousTable = (documents) => {

        let self = this;
  
        const sortedConsensousTable = documents.sort((a, b) => b['kwm'] - a['kwm']);
        // console.log(sortedConsensousTable)
        const numberOfValidators = sortedConsensousTable.length;
        // const numberOfValidators = 4;
        const numberOfWeights = Object.keys(self.weights).length;
        self.validatorCounter = numberOfValidators;
        let quotient = Math.floor(numberOfWeights/numberOfValidators);
        let remainder = numberOfWeights % numberOfValidators;
        
        // Crea array lleno de x números de 0s, donde x es la cantidad de validadores
        const moduleSum = new Array(numberOfValidators).fill(0);
        let countMS = 0;
        while (remainder != 0){
            moduleSum[countMS] = moduleSum[countMS] + 1;
            remainder--;
            countMS++;
            if (countMS == numberOfValidators){
                countMS = 0;
            }
        };
        
        let pastBound = 0;
        sortedConsensousTable.forEach( (element, index) => {
            element['ccr'] = pastBound+"-"+(pastBound+quotient+moduleSum[index]-1);
            pastBound = pastBound+quotient+moduleSum[index];
        });
        
        self.calculatedConsensousTable = sortedConsensousTable;

    }

    sendCalculatedConsensousTable = async () => {

        let self = this;
        let promises = Array();
        let ip = this.obtainIp();
        let calculatedccr = JSON.stringify(this.calculatedConsensousTable);
        let validatorsNumber = this.validatorCounter;

        let ccr = [ip, validatorsNumber, calculatedccr]; 
        ccr = JSON.stringify(ccr);
        
        // let ccr2 = 'Mensaje desde: '+ip;

        return new Promise((resolve, reject) =>{

            self.hosts.forEach( element => {

                let segundos = new Date().getSeconds();
                console.log('Envio de ccr desde: ' + ip + ' hacia ' + element + ' a los: ' + segundos + ' segundos.');

                // Envio a cada host, se trabaja como una promesa para tener una medida sobre el resultado de cada envío
                let promise = new Promise((resolve_host, reject_host) => {
                    
                    // Post de axios hacia el puerto 3000 de cada host, hacia el archivo validatorIT
                    axios.post(`http://${element}:3000/ccrReciver`, {
                        ccr: ccr
                        }).then(function(response) {
                            // console.log("BIEN")
                            console.log(response.data)
                            resolve_host(response.data);
                        }).catch(function(error) {
                            // console.log("Error: "+error);
                            reject_host(error);
                        })  
                    
                }).catch( (err) => {
                    // Manejo de error
                    // console.log(err);
                    reject_host(err);
                });
    
                promises.push(promise);
    
            });
    
            // Se hace uso de allSettled, método que permite manejas múltiples promesas simultaneamente, las cuales pueden ser independientes de las otroas
            Promise.allSettled(promises)
            .then((result) => {
                console.log(result);
                console.log("Promesas Q3 cumplidas");
                resolve(result)
            });

        }).catch( (err) => {
            // Manejo de error
            console.log(err);
            reject(err);
        });

    }

    // Funciones de Q4

    resolveAnyInconsistency = async (arrayCcrs) => {

        let self = this;
    
        let numberOfValidators = arrayCcrs.length;
    
        let votes = new Array();

        return new Promise((resolve, reject) => {
    
            arrayCcrs.forEach( (element, index) => {
                // Si es el primero
                if (index == 0){
                    votes.push({'validators': element['validators'], kwm: element['kwm'], votes:1});
                } 
                // Si no es el primero
                else {
                    // Comparamos con los elementos del array votes para sumar un voto si hay coincidencia y si no ingresar el valor en el array como un nuevo elmento
                    // Booleano para saber si se encontro coincidencia
                    let coincidencia = false;
                    // Se bota para saber que ccr se tomara como el final de periodo
                    votes.forEach( (elementCoincidente, indexCoincidente) => {
                        // Si se encuantra coincidencia se suma 1 a los votos del elemento coincidente
                        if ( ( element['validators'] == elementCoincidente['validators'] ) && ( element['kwm'] == elementCoincidente['kwm'] ) ){
                            votes[indexCoincidente]['votes']++;
                            coincidencia = true;
                        }
                    });
                    // Si el valor que se compara no es igual a ninguno anterior se agrega a la lista de votos para ser comparado y votado en caso de coincidencia
                    if (!coincidencia){
                        votes.push({'validators': element['validators'], kwm: element['kwm'], votes:1});
                    }
                }
            });
        
            // Votacion ya finalizada
            // Se procede a resolver inconsistencias mediante el 66% o mas del total
        
            console.log(votes);

            let isResolved = false;
        
            votes.forEach(element => {
                let percent = self.getPercentage(element['votes'], numberOfValidators);
                if (percent > self.byzantineNumber){
                    // Se resuelve el CCR final para el período
                    let ccrResuelto = {validators: element['validators'], ccr: element['kwm'], percent: percent};
                    self.ccrFinal = ccrResuelto;
                    isResolved = true;
                    resolve(ccrResuelto)
                }
            });

            if (!isResolved){
                reject(0);
            }

        });
    
    }

    generateGenesis = (ccr) => {

        let self = this;
        let totalVal = new Array();
        // console.log('BLOQUE GÉNESIS: ');

        ccr.forEach(element => {
            totalVal.push(element['ip']); 
        });
        console.log('TOTALval: '+totalVal);

        let genesis = {
            'totalVal': totalVal,
            'validatorsNTuple': ccr
        };

        return genesis;
    }

    getCCRs = async () => {

        return new Promise(async (resolve, reject) => {
    
            const url = "mongodb://127.0.0.1:27017";
            const client = new MongoClient(url);
            // Base de datos
            const dbName = "blockchain";
            await client.connect();    
            const db = client.db(dbName);
            // Usamos la colección "block"
            const col = db.collection("validatorsCCRs");
            
            // Leemos los documentos
            const p = col.find({},{projection:{ _id: 0 }}).toArray(function(err, result) {
                if (err) throw err;
                // console.log(result);
                client.close();
                resolve(result);
            });
    
        }).catch( (err) => {
            // Manejo de error
            console.log(err);
            reject(err);
        });
        
    }

    clearCCRs = async () => {

        return new Promise(async (resolve, reject) => {
    
            const url = "mongodb://127.0.0.1:27017";
            const client = new MongoClient(url);
            // Base de datos
            const dbName = "blockchain";
            await client.connect();    
            const db = client.db(dbName);
            // Usamos la colección "block"
            const col = db.collection("validatorsCCRs");
            
            // Insertamos un documento para leerlo a continuación
            const p = col.drop(function(err, delOK) {
                if (err) throw err;
                if (delOK) console.log("CCR's cleared (validatorsCCRs collection cleared).");
                client.close();
                resolve(delOK);
            });
    
        }).catch( (err) => {
            // Manejo de error
            console.log(err);
            reject(err);
        });
        
    }

    sendSignedGenesis = async (genesisBlock) => {

        console.log('Enviando Bloque Genesis a la red.');

        let self = this;
        let promises = Array();
        genesisBlock = JSON.stringify(genesisBlock);

        return new Promise((resolve, reject) =>{

            self.hosts.forEach( element => {

                // Envio a cada host, se trabaja como una promesa para tener una medida sobre el resultado de cada envío
                let promise = new Promise((resolve_host, reject_host) => {
                    
                    // Post de axios hacia el puerto 3000 de cada host, hacia el archivo validatorIT
                    axios.post(`http://${element}:3000/genesisBlockVerification`, {
                            genesisBlock: genesisBlock,
                        }).then(function(response) {
                            // console.log("Post recibido por server.")
                            let firma = response.data;
                            if( firma[0] == true ){
                                console.log('Bloque genesis firmado por: '+element);
                            } else {
                                console.log('Algo salio mal en firma de bloque genesis por: '+element);
                            }
                            resolve_host(firma);
                        }).catch(function(error) {
                            console.log("Error: "+error);
                            reject_host(error);
                        })  
                    
                }).catch( (err) => {
                    // Manejo de error
                    console.log(err);
                    reject_host(err);
                });
    
                promises.push(promise);
    
            });
    
            // Se hace uso de allSettled, método que permite manejar múltiples promesas simultaneamente, las cuales pueden ser independientes de las otroas
            Promise.allSettled(promises)
            .then((result) => {
                console.log(result);
                console.log("Promesas GENESIS COMPARACION, Genesis enviado.");
                resolve(result)
            }).catch((error) => {   
                console.log(error);
                reject(error);
            });

        }).catch( (err) => {
            // Manejo de error
            console.log(err);
            reject(err);
        });

    }

    saveGenesis = async (genesis) => {

        return new Promise(async (resolve, reject) => {
    
            const url = "mongodb://127.0.0.1:27017";
            const client = new MongoClient(url);
            // Base de datos
            const dbName = "blockchain";
            await client.connect();    
            const db = client.db(dbName);
            // Usamos la colección "block"
            const col = db.collection("currentGenesis");
            
            // Insertamos un documento para leerlo a continuación
            const p = col.insertOne(genesis, {'w': 0}, function(error, docsInserted){

                if(error) {
                    console.log('Error occurred while inserting: '+error);
                    resolve(0);
                } else {
                    console.log('Documento insertado; Genesis Actual: ' + JSON.stringify(docsInserted));
                    resolve(1);
                }

            });
    
        }).catch( (err) => {
            // Manejo de error
            console.log(err);
            reject(err);
        });
        
        
    }

    validateSignedGenesis = (signs, genesis) => {

        let self = this;
    
        let numberOfValidators = signs.length;
    
        let votes = new Array();

        signs.forEach( (element, index) => {
            // Si es el primero
            if (index == 0){
                votes.push({'signed': element['value'][0], votes:1});
            } 
            // Si no es el primero
            else {
                // Comparamos con los elementos del array votes para sumar un voto si hay coincidencia y si no ingresar el valor en el array como un nuevo elmento
                // Booleano para saber si se encontro coincidencia
                let coincidencia = false;
                // Se bota para saber que ccr se tomara como el final de periodo
                votes.forEach( (elementCoincidente, indexCoincidente) => {
                    // Si se encuantra coincidencia se suma 1 a los votos del elemento coincidente
                    if ( ( element['value'][0] == elementCoincidente['signed'] ) ){
                        votes[indexCoincidente]['votes']++;
                        coincidencia = true;
                    }
                });
                // Si el valor que se compara no es igual a ninguno anterior se agrega a la lista de votos para ser comparado y votado en caso de coincidencia
                if (!coincidencia){
                    votes.push({'signed': element['value'][0], votes:1});
                }
            }

            // Continuar para agregar firmas a bloque y que sea verficable para la red
            // if (element['value'][0] == true){
            //     genesis.push(element['value'][0])
            // }
            
        });

        console.log('Numero de validadores que firmaron el bloque: '+JSON.stringify(votes));

        let isResolved = false;
        
        votes.forEach(element => {
            let percent = self.getPercentage(element['votes'], numberOfValidators);
            if (percent > self.byzantineNumber){
                // Se resuelve el CCR final para el período
                // let ccrResuelto = {validators: element['validators'], ccr: element['kwm'], percent: percent};
                
                // self.ccrFinal = ccrResuelto;
                isResolved = true;
                // resolve(ccrResuelto)
            }
        });

        if (isResolved){
            console.log('Bloque genesis firmado por mas de un 66% de la red');
        } else {
            console.log('Bloque genesis NO firmado por mas de un 66% de la red');
        }

        return isResolved;

    }

    // Envio de genesis a la red firmado por mas de un 66% 
    sendSettledGenesis = async (genesisBlock) => {

        console.log('Enviando Bloque Genesis Firmado a la red.');

        let self = this;
        let promises = Array();
        genesisBlock = JSON.stringify(genesisBlock);
        console.log(genesisBlock);

        return new Promise((resolve, reject) =>{

            self.hosts.forEach( element => {

                // Envio a cada host, se trabaja como una promesa para tener una medida sobre el resultado de cada envío
                let promise = new Promise((resolve_host, reject_host) => {
                    
                    // Post de axios hacia el puerto 3000 de cada host, hacia el archivo validatorIT
                    axios.post(`http://${element}:3000/genesisBlockInsert`, {
                            genesisBlock: genesisBlock,
                        }).then(function(response) {
                            // console.log("Post recibido por server.")
                            let firma = response.data;
                            if( firma[0] == true ){
                                console.log('Bloque genesis firmado por: '+element);
                            } else {
                                console.log('Algo salio mal en firma de bloque genesis por: '+element);
                            }
                            resolve_host(firma);
                        }).catch(function(error) {
                            console.log("Error: "+error);
                            reject_host(error);
                        })  
                    
                }).catch( (err) => {
                    // Manejo de error
                    console.log(err);
                    reject_host(err);
                });
    
                promises.push(promise);
    
            });
    
            // Se hace uso de allSettled, método que permite manejar múltiples promesas simultaneamente, las cuales pueden ser independientes de las otroas
            Promise.allSettled(promises)
            .then((result) => {
                console.log(result);
                console.log("Promesas GENESIS COMPARACION, Genesis enviado.");
                resolve(result)
            }).catch((error) => {   
                console.log(error);
                reject(error);
            });

        }).catch( (err) => {
            // Manejo de error
            console.log(err);
            reject(err);
        });

    }

    clearGenesis = async () => {

        return new Promise(async (resolve, reject) => {
    
            const url = "mongodb://127.0.0.1:27017";
            const client = new MongoClient(url);
            // Base de datos
            const dbName = "blockchain";
            await client.connect();    
            const db = client.db(dbName);
            // Usamos la colección "block"
            const col = db.collection("currentGenesis");

            // Se limpia collecion ccr
            const p = col.deleteMany({});
    
        }).catch( (err) => {
            // Manejo de error
            console.log(err);
            reject(err);
        });
        
    }

    // Q6

    sendNormalTransaction = async (transaction) => {

        console.log('Enviando transaccion a Transaction Pool.');

        let self = this;
        let promises = Array();
        transaction = JSON.stringify(transaction);

        return new Promise((resolve, reject) =>{

            self.hosts.forEach( element => {

                // Envio a cada host, se trabaja como una promesa para tener una medida sobre el resultado de cada envío
                let promise = new Promise((resolve_host, reject_host) => {
                    
                    // Post de axios hacia el puerto 3000 de cada host, hacia el archivo validatorIT
                    axios.post(`http://${element}:3000/transactionReciver`, {
                            transaction: transaction,
                        }).then(function(response) {
                            // console.log("BIEN")
                            // console.log(response.data)
                            resolve_host(response.data);
                        }).catch(function(error) {
                            console.log("Error: "+error);
                            reject_host(error);
                        })  
                    
                }).catch( (err) => {
                    // Manejo de error
                    console.log(err);
                    reject_host(err);
                });
    
                promises.push(promise);
    
            });
    
            // Se hace uso de allSettled, método que permite manejar múltiples promesas simultaneamente, las cuales pueden ser independientes de las otroas
            Promise.allSettled(promises)
            .then((result) => {
                console.log(result);
                console.log("Promesas Q6, transaccione cumplidas");
                resolve(result)
            });

        }).catch( (err) => {
            // Manejo de error
            console.log(err);
            reject(err);
        });
        
    }

    // Inserta en BD los ccr que vienen de los validadores 
    insertIntoTransactionHistory = async ( transaction ) => {

        const url = "mongodb://127.0.0.1:27017";
        const client = new MongoClient(url);
        // Base de datos
        const dbName = "blockchain";
        client.connect();
        const db = client.db(dbName);

        // Usamos la colección "block"
        const col = db.collection("transactionHistory");
        
        // Insertamos un documento para leerlo a continuación
        const p = col.insertOne(transaction, {'w': 0}, function(error, docsInserted){

            if(error) {
                console.log('Error occurred while inserting: '+error);
            } else {
                console.log('Documento insertado Q6 HISTORIA: ' + JSON.stringify(docsInserted));
            }

        });

    }

    // Q7

    getCurrentGenesis = async () => {

        return new Promise(async (resolve, reject) => {
    
            const url = "mongodb://127.0.0.1:27017";
            const client = new MongoClient(url);
            // Base de datos
            const dbName = "blockchain";
            await client.connect();    
            const db = client.db(dbName);
            // Usamos la colección "block"
            const col = db.collection("lastUpdate");
            
            // Leemos un documento
            const p = col.findOne({}, function(err, result) {
                if (err) {
                    reject(err);
                };
                resolve(result);
            });
    
        }).catch( (err) => {
            // Manejo de error
            console.log(err);
            reject(err);
        });
        
    }

    getTransactions = async () => {

        return new Promise(async (resolve, reject) => {
    
            const url = "mongodb://127.0.0.1:27017";
            const client = new MongoClient(url);
            // Base de datos
            const dbName = "blockchain";
            await client.connect();    
            const db = client.db(dbName);
            // Usamos la colección "block"
            const col = db.collection("transactionPool");
            
            // Leemos los documentos
            const p = col.find({},{projection:{ _id: 0 }}).toArray(function(err, result) {
                if (err) throw err;
                // console.log(result);
                client.close();
                resolve(result);
            });
    
        }).catch( (err) => {
            // Manejo de error
            console.log(err);
            reject(err);
        });
        
    }

    generateBlock = async (epochGenesis, transactions) => {

        const url = "mongodb://127.0.0.1:27017";
        const client = new MongoClient(url);
        // Base de datos
        const dbName = "blockchain";
        client.connect();    
        const db = client.db(dbName);
        // Usamos la colección "block"
        const col = db.collection("verified");

        let self = this;

        let genesisHash = epochGenesis['blockhash'];
        let genesis = epochGenesis['genesis'];
        let merkleRoot = '0';

        let validatorTransactions = new Array();

        genesis["validatorsNTuple"].forEach(element => {
            if (element['ip'] == self.machineIP){

                let fields = element['ccr'].split('-');
                let minimo = fields[0];
                let maximo = fields[1];

                console.log('');
                console.log('Maquina: '+self.machineIP);
                console.log('Genera bloque para transacciones entre: '+minimo+' y '+maximo+'.');
                console.log('');

                transactions.forEach(transaction => {

                    let transactionFirstChar = transaction['id'].charAt(0);
                    let transactionWeight = self.weights[transactionFirstChar];
                    
                    if ( ( transactionWeight >= minimo ) && ( transactionWeight <= maximo ) ){
                        console.log('Valida transaccion desde: '+JSON.parse(transaction['body'])['input']);
                        validatorTransactions.push(transaction['id']);
                    }
                });
            }
        });

        if (validatorTransactions.length > 0){
            // console.log('DEPURACION VALIDATOR TRANSACTIONS ARRAY: '+JSON.stringify(validatorTransactions));
            const leaves = validatorTransactions.map(x => SHA256(x))
            const tree = new MerkleTree(leaves, SHA256)
            let root = tree.getRoot().toString('hex')

            let block = '';
            
            validatorTransactions.forEach( async (element) => {

                const leaf = SHA256(element)
                const proof = tree.getProof(leaf)
                let jsonStr = MerkleTree.marshalProof(proof);
                
                if (validatorTransactions.length == 1){
                    console.log('Transaccion '+element+' verificada.');
                    block = {'element': element, 'proof': element};
                }
                else if (tree.verify(proof, leaf, root)){
                    console.log('Transaccion '+element+' verificada.');
                    if (validatorTransactions.length > 1){
                        block = {'element': element, 'proof': jsonStr.replace(/(\r\n|\n|\r)/gm, "")};
                    } 
                    
                } // true

                // Insertamos un documento para leerlo a continuación
                const p = await col.insertOne(block);
                console.log('Insertado');

            });

            // const leaf = SHA256('a')
            // const proof = tree.getProof(leaf)
            // console.log(tree.verify(proof, leaf, root)) // true
    
            return {'genesisHash': genesisHash, 'merkleRoot': root};
    
        } 
        
        return false;
        
    }

    insertIntoVerified = async ( block ) => {

        console.log('INSERTANDO VERI');
        console.log(block)

        const url = "mongodb://127.0.0.1:27017";
        const client = new MongoClient(url);
        // Base de datos
        const dbName = "blockchain";
        await client.connect();    
        const db = client.db(dbName);
        // Usamos la colección "block"
        const col = db.collection("verified");
        
        // Insertamos un documento para leerlo a continuación
        const p = await col.insertOne(block);

    }

    insertIntoLedger = async ( block ) => {

        const url = "mongodb://127.0.0.1:27017";
        const client = new MongoClient(url);
        // Base de datos
        const dbName = "blockchain";
        await client.connect();    
        const db = client.db(dbName);
        // Usamos la colección "block"
        const col = db.collection("ledger");
        
        // Insertamos un documento para leerlo a continuación
        const p = await col.insertOne(block, {'w': 0}, function(error, docsInserted){

            if(error) {
                console.log('Error occurred while inserting: '+error);
            } else {
                console.log('Bloque insertado Q7');
            }

        });

    }

    clearTransactions = async () => {
        
        console.log('Limpiando transacciones para recibir mas');

        return new Promise(async (resolve, reject) => {
    
            const url = "mongodb://127.0.0.1:27017";
            const client = new MongoClient(url);
            // Base de datos
            const dbName = "blockchain";
            await client.connect();    
            const db = client.db(dbName);
            // Usamos la colección "block"
            const col = db.collection("transactionPool");

            // Se limpia collecion ccr
            const p = col.deleteMany({});
    
        }).catch( (err) => {
            // Manejo de error
            console.log(err);
            reject(err);
        });
        
    }

    // Utilities

    clearDb = () => {

        const url = "mongodb://127.0.0.1:27017";
        const client = new MongoClient(url);
        // Base de datos
        const dbName = "blockchain";
        client.connect().then((client) => {
  
            // Reference of database
            const connect = client.db(dbName);
          
            // Dropping the database
            connect.dropDatabase();
          
            console.log("Dropping successful");
        }).catch((err) => {
            console.log(err.Message);
        })

    }

    printGenesisAd = () => {
        console.log('');
        console.log('----------------------------------');
        console.log('----------------------------------');
        console.log('----------------------------------');
        console.log('----- SOY EL VALIDADOR LIDER -----');
        console.log('----------------------------------');
        console.log('----------------------------------');
        console.log('----------------------------------');
        console.log('');
    }

    printQ = (q, seg) => {
        console.log('');
        console.log('+============================+');
        console.log('============  Q'+q+'  ============');
        console.log('======  Segundos: '+seg+'  =======');
        console.log('+============================+');
        console.log('');
    }

    getPercentage = (partialValue, totalValue) => {
        return (100 * partialValue) / totalValue;
    } 

    getRandomInt = (max) => {
        return Math.floor(Math.random() * max);
    }

}

// module.exports = ITSender;

let sender = new ITSender();