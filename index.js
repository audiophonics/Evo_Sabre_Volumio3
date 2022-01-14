'use strict';

const 	libQ 		= require('kew'),
		{ exec } 	= require('child_process'),
		http 		= require('http');
		
	
		
module.exports = audiophonicsEvoSabre;

function audiophonicsEvoSabre(context) {
	this.context 		= context;
	this.commandRouter 	= this.context.coreCommand;
	this.logger 		= this.context.logger;
	this.configManager	= this.context.configManager;
	this.translate 		= this.commandRouter.getI18nString; // Short alias for lisibility 
}

audiophonicsEvoSabre.prototype.onVolumioStart = function(){
	const 	configFile = this.commandRouter.pluginManager.getConfigurationFile( this.context, 'config.json' );
    this.config	= new (require('v-conf'))();
    this.config.loadFile(configFile);
    return libQ.resolve();
}

audiophonicsEvoSabre.prototype.onStart = function(){
	const 	defer = libQ.defer(),
			self = this;
	
	this.logger.info( "EVO SABRE : Starting Plugin" );	
	
	this.systemctl('daemon-reload')
		.then( ()=>{ this.configSoftLink() } )
		.then( ()=>{ this.startServiceIfActive("oled_active","evo_oled2") } )
		.then( ()=>{ this.setRemoteActive( this.config.get("remote_active") ) } )
		.then( ()=>{ defer.resolve() } )
	return defer.promise;
};

audiophonicsEvoSabre.prototype.onStop = function (){
	const 	defer = libQ.defer(),
			self = this;
	this.systemctl('stop evo_oled2.service')
		.then( ()=>{ self.systemctl('stop lircd.service') } )
		.then( ()=>{ self.systemctl('stop irexec.service') } )
		.then( ()=>{ defer.resolve() } );
	return defer.promise;
};

audiophonicsEvoSabre.prototype.onRestart = audiophonicsEvoSabre.prototype.restartOled = function(){
	const 	defer = libQ.defer();
	this.systemctl('restart evo_oled2.service')
		.then( ()=>{ defer.resolve() });
	return defer.promise;
};

// Configuration Methods -----------------------------------------------------------------------------

audiophonicsEvoSabre.prototype.startServiceIfActive = function(config,service){
	const 	defer = libQ.defer();
	if(this.config.get(config)) this.systemctl(`restart ${service}.service`).then( ()=>{ defer.resolve() });
	else{
		return libQ.resolve();
	}
	return defer.promise;
};


audiophonicsEvoSabre.prototype.getUIConfig = function(){
    const 	defer 					= libQ.defer(), 
			lang_code 				= this.commandRouter.sharedVars.get('language_code'),
			target_lang_path 		= `${__dirname}/i18n/strings_${lang_code}.json`, 
			fallback_lang_path		= `${__dirname}/i18n/strings_en.json`, 
			config_template_path 	= `${__dirname}/UIConfig.json`;
			
	
    this.commandRouter.i18nJson( target_lang_path, fallback_lang_path, config_template_path )
		.then( (uiconf )=>{
			uiconf.sections[0].content[0].value = this.config.get('oled_active');		
			
			uiconf.sections[0].content[1].value = parseInt(this.config.get('contrast'));
			uiconf.sections[0].content[1].attributes  = [{min:1, max:254}]; 
			
			uiconf.sections[0].content[2].value = parseInt(this.config.get('sleep_after'));
			uiconf.sections[0].content[2].attributes  = [{min:1}]; 
			
			uiconf.sections[0].content[3].value = parseInt(this.config.get('deep_sleep_after'));
			uiconf.sections[0].content[3].attributes  = [{min:1}]; 

			uiconf.sections[1].content[0].value = this.config.get('remote_active');

			defer.resolve(uiconf);
		})
        .fail( ()=>{defer.reject()} );
    return defer.promise;
};


audiophonicsEvoSabre.prototype.getUIConfigOnPlugin = audiophonicsEvoSabre.prototype.getUIConfig; // not sure which one is used, seen both in doc so I guess this'll have to do for now

audiophonicsEvoSabre.prototype.getConfigurationFiles = function(){ return ['config.json'] }

audiophonicsEvoSabre.prototype.updateOledConfig = function(data){
	const 	defer = libQ.defer();
	
	this.config_changes = {};
	this.config_errors = [];
	
	this.validateAndUpdateConfigItem( data, "oled_active" );
	this.validateAndUpdateConfigItem( data, "contrast" , 			x=> x>0 && x<255 );
	this.validateAndUpdateConfigItem( data,	"sleep_after" , 		x=> x>=0 		 );
	this.validateAndUpdateConfigItem( data,	"deep_sleep_after" , 	x=> x>=0 		 );
	
	if(!Object.keys(this.config_changes).length) this.commandRouter.pushToastMessage('info', "EVO SABRE : ", "Nothing changed in new OLED configuration.");
	else this.commandRouter.pushToastMessage('success', "EVO SABRE : ", "Configuration updated.");
	
	// sync tasks
	if( "oled_active" in this.config_changes ){
		this.config.get("oled_active") && this.systemctl("restart evo_oled2.service") || this.systemctl("stop evo_oled2.service");
		delete this.config_changes["oled_active"];
	}
	
	for( let err of this.config_errors  ) this.commandRouter.pushToastMessage('error', "EVO SABRE : ", err);
	for( let key in this.config_changes ){  // some configs options can be updated in real time without restarting oled script with a basic http call.
		if (key in ["contrast","sleep_after","deep_sleep_after" ]){ 
			try{http.get(`http://127.0.0.1:4153/${key}=${this.config_changes[key]}`)}
			catch(e){}
		}
	} 
	
	this.logger.info('EVO SABRE : OLED#2 configuration updated from UI.');
	
	defer.resolve();
	return defer.promise;
}

audiophonicsEvoSabre.prototype.updateRemoteConfig = function(data){
	const 	defer 	= libQ.defer();
	
	this.config_changes = {};
	this.config_errors = [];
	this.validateAndUpdateConfigItem( data, "remote_active" );

	for( let err of this.config_errors  ) this.commandRouter.pushToastMessage('error', "EVO SABRE : ", err);
	
	if(!Object.keys(this.config_changes).length){
		this.commandRouter.pushToastMessage('info', "EVO SABRE : ", "Nothing changed in new remote configuration.");
		return defer.resolve();
	}
	else{
		// sync tasks
		if( "remote_active" in this.config_changes ){
			this.setRemoteActive( this.config.get("remote_active")) ;
		}
		this.logger.info('EVO SABRE : Remote configuration updated from UI.');
		this.commandRouter.pushToastMessage('success', "EVO SABRE : ", "Configuration updated.");
		return defer.resolve();
	}
	return defer.promise;
}

audiophonicsEvoSabre.prototype.validateAndUpdateConfigItem = function(obj, key, validation_rule){
	// check dataset, key, value exists and that it is different from current value.
	if ( obj && key && obj[key] !== undefined && obj[key] != this.config.get(key) ) {
		// also make sure new value is valid according to the provided validation method (if any)
		if ( !validation_rule || validation_rule( obj[key] ) ){
			this.config.set(key, obj[key]);
			this.config_changes[key] = obj[key];
		}
		else{
			this.config_errors.push(`EVO SABRE : invalid config value ${key} ${obj[key]}. `)
		}
	};
}

audiophonicsEvoSabre.prototype.configSoftLink = function(data){
	/* 
		Display app needs to read from config.json when starting.
		This creates a symlink of the config.json file into __dirname/app dir. 
		config.filePath seems dynamically attributed and using its data to 
		renew the link every time volumio starts sounds like the most robust solution at this time.
	*/
	const defer = libQ.defer(), 
	handle = (error, stdout, stderr)=>{
		defer.resolve()
		};
	exec(`/bin/ln -s ${this.config.filePath} ${__dirname+"/app"}`, { uid: 1000, gid: 1000 }, handle);
	return defer.promise;
}

audiophonicsEvoSabre.prototype.diagnoseRemote = function(){
	this.checkRemoteService()
	.then( ( remote_status )=>{
		this.commandRouter.broadcastMessage("openModal",{
			title: 'System Information',
			message: remote_status,
			size: 'lg',
			buttons: [{
				name: 'Close',
				class: 'btn btn-warning',
				emit: 'closeModals',
				payload: ''
			}]
		});	
	});
	return libQ.resolve();
};

audiophonicsEvoSabre.prototype.setRemoteActive = function(status){
	const 	defer = libQ.defer(),
			self = this;
	if(!status){
		this.systemctl('stop lircd.service')
		.then( ()=>{ this.systemctl('stop irexec.service') } )
		.then( ()=>{ defer.resolve() } );
	}		
	else{
		this.systemctl('restart lircd.service')
		.then( ()=>{ this.systemctl("restart irexec.service") } )
		.then( ()=>{ defer.resolve() } );
	}		
	return defer.promise;
};

audiophonicsEvoSabre.prototype.setUIConfig = function(data){};
audiophonicsEvoSabre.prototype.getConf = function(varName){};
audiophonicsEvoSabre.prototype.setConf = function(varName, varValue){};


// System Helpers -----------------------------------------------------------------------------

audiophonicsEvoSabre.prototype.systemctl = function (cmd){
	const defer = libQ.defer(), 
	handle = (err, stdout, stderr)=>{
		if (err) {
			this.logger.error(`EVO SABRE : systemd failed cmd ${cmd} : ${err}`);
			this.commandRouter.pushToastMessage('error', "EVO SABRE :", `Systemd command failed : ${cmd} : ${err}.`);
			defer.reject();
			return;
		} 
		this.logger.info(`EVO SABRE : systemd cmd ${cmd} : success`);
		defer.resolve();
	};
	exec('/usr/bin/sudo /bin/systemctl ' + cmd, { uid: 1000, gid: 1000 }, handle);
	return defer.promise;
};

audiophonicsEvoSabre.prototype.checkRemoteService = function (){
	
	if( !this.config.get("remote_active") ){ 
		return libQ.resolve("You must enable the remote service before you can query whether it is working properly.");
	}
	
	const defer = libQ.defer(),
	query_service_active = function(service){  
		return new Promise((resolve, reject) => {
			exec(`systemctl is-active ${service}.service`, (err,stdout,stderr)=>{
				return resolve( stdout === "active\n" );
			});
		});
	}, 
	query_lirc_remote = new Promise((resolve, reject) => {
		exec("journalctl -u lircd.service --no-pager", (err,stdout,stderr)=>{
			if(err) return resolve(false);
			let current_remote,
			reg_res,
			test_str = stdout.toString(),
			reg = /Info: Using remote:[\s]+(?<remote_name>.*?)\./g;
			while( reg_res = reg.exec(test_str) ) current_remote = reg_res.groups.remote_name;
			return resolve( current_remote );
		});
	});
	
	Promise.all([query_service_active("lircd"), query_service_active("irexec"), query_lirc_remote])
	.then((values)=>{
		let lircd_systemd_active = values[0],
		irexec_systemd_active = values[1],
		current_remote = values[2],
		right_target_remote = (current_remote === "ApEvo"),
		all_ok = (lircd_systemd_active && irexec_systemd_active && right_target_remote)?"Configuration OK.":"Something is wrong in your remote configuration. You may want to reboot your Evo Sabre to see if problem persists. If so simply reinstall this plugin and make sure there is no other plugin using the lirc remote configuration.";
		
		let html = `
			<ul>
				<li>LIRC daemon : ${lircd_systemd_active?"OK":"ERROR"}</li>
				<li>IREXEC daemon : ${irexec_systemd_active?"OK":"ERROR"}</li>
				<li>LIRC is using ApEvo remote : ${right_target_remote?"OK":"ERROR"} (${current_remote})</li>
			</ul>
			<p>${all_ok}</p>
		`;
		defer.resolve(html);
	})
	.catch((error)=>{
			this.commandRouter.pushToastMessage('error', "EVO SABRE : ", "Fatal error with remote service. Please reboot your Evo Sabre and reinstall this plugin if you see this message again.");
	});

	return defer.promise;
};

