var HostName = 'my-dcc.local';

var MQTT = (function(){
	this.endpoint = axios.create({
	  	baseURL: 'http://' + HostName + ':1880/'
	});
	this.send = function(message, topic){
		topic = topic || 'DCC';
		this.endpoint.post('mqtt',{topic: topic, message: message})
	}
	return this;
})();

var Couch = (function(){
	this.connect = function(){
		this.db = axios.create({
		  	baseURL: 'http://' + HostName + ':5984/'
		});
	}

	this.throttleQueue = null;

	this.getEngines = function(){
		return this.db.get("engines/_all_docs?include_docs=true");
	}
	this.addEngine = function(engine){
		var record = TrainMQTTMessage.filterMethods(engine);
		if(record._id === null){
			delete record._id;
		}
		if(record._rev === null){
			delete record._rev;
		}
		return this.db.post("engines", record).then(function(success){
			engine._id = success.data.id;
			engine._rev = success.data.rev;
		});
	}
	this.updateEngine = function(engine){
		clearTimeout(this.throttleQueue);
		this.throttleQueue = window.setTimeout(function(){
			var record = TrainMQTTMessage.filterMethods(engine);
			MQTT.send(TrainMQTTMessage.serializeObject(engine),'DCC');
			this.db.put("engines/" + engine._id, record).then(function(success){
				engine._id = success.data.id;
				engine._rev = success.data.rev;
			});
		}, 300);
	}
	this.connect();
	return this;
})();

var App = new Vue({
    el: '#commanderApp',
    data: {
        engines: []
    },
	methods: {
	    newEngine: function () {
	    	var engine = new Engine();
	    	var vue = this;
	    	Couch.addEngine(engine).then(function(){
	    		vue.engines.push(engine);
	        	Vue.nextTick(componentHandler.upgradeAllRegistered);
	    	});
	    },
	    setThrottle: function(event, engine){
	    	var position = event.target.value;
	    	if(position > -.05 && position < .05){
	    		position = 0;
	    	}
	    	engine.throttle = position; 
	    	Couch.updateEngine(engine);
	    },
	    toggleEdit: function(engineId){
	    	var card = document.getElementById('engine-'+engineId);
	    	card.classList.toggle("editting");
	    },
	    updateEngine: function(engine){
	    	Couch.updateEngine(engine);
	    },
	    setHostName: function(hostName){
	    	HostName = hostName;
	    	//MQTT connect
	    	MQTT.connect();
	    	//CouchDB connect
	    	Couch.connect();
	    	var vue = this;
			Couch.getEngines().then(function(req){
				req.data.rows.forEach(function(row){
					var engine = new Engine(row.doc);
					console.log(row, engine);
					this.engines.push(engine);

				}, vue);

				Vue.nextTick(componentHandler.upgradeAllRegistered);
			});
	    }
	},
	created: function(){
		var vue = this;
		Couch.getEngines().then(function(req){
			req.data.rows.forEach(function(row){
				var engine = new Engine(row.doc);
				console.log(row, engine);
				this.engines.push(engine);

			}, vue);

			Vue.nextTick(componentHandler.upgradeAllRegistered);
		});
	}
});