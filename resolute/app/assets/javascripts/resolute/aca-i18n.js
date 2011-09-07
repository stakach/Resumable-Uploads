// http://kallesaas.com/code/translate.js

(function () {
	if (!window.translate) {
		/** 	
		 * this global function is for string substitution
		 * @property {string} string to translate.
		 * @property {string} as much 
		 * return STRING
		 */				 
		window.translate = function(){
			var html = [ ];
			var arguments = arguments;
			var format = arguments[0];

			var objIndex = 0;
			var reg = /\%s/;
			var parts = [ ];

			/** 
			 * analyze the string, extract the parts with the %s identifier.
			 */							 
			for ( var m = reg.exec(format); m; m = reg.exec(format) ) {				
				parts.push(format.substr(0, m[0][0] == "%" ? m.index : m.index));
				parts.push("%s");
				format = format.substr(m.index+m[0].length);
			}

			parts.push(format);

			/** 
			 * analyze the parts, replace the %s with the given arguments. 
			 * beware of undefined!
			 */							 
			for (var i = 0; i < parts.length; ++i){
				var part = parts[i];
				
				if (part && part === "%s"){
					var object = arguments[++objIndex];
					
					if (object === undefined) {
						html.push("%s");
					}else{
						html.push(object);
					};
				}
				else{
					html.push(part);
				}
			}

			/** 
			 * Join the array and return as string.
			 */
			return html.join('');
		}
	};
})();