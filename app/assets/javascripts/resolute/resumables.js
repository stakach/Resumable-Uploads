/**
*	jQuery.resumable()
*	This provides HTML5 uploads with a resume function if it is avaliable.
*	
*   Copyright (c) 2011 Advanced Control and Acoustics, based on code by Mihail Dektyarow
*	
*	@author 	Stephen von Takach <steve@advancedcontrol.com.au>
* 	@copyright  2011 advancedcontrol.com.au
*	@version    1.1
* 
**/


(function($) {
	
	
	//
	// Uploads files using HTML5 FileAPI
	//
	function upload($this) {
		var data = $this.data('resumable'),
		options = data.options,
			failures = 0,
			uploaded = 0,
			result;
			
		if (data.files.length == 0) {
			return false; // Safari will try and upload 0 files
		}
		
		//
		// Allow onStart to cancel or remove unsupported files
		//
		result = $this.triggerHandler('onStart', [data.files]);
		if (result !== false) {
			if(result !== undefined)
				data.files = result;
		} else {
			return false;
		}
		
		if (data.files.length == 0) {
			return false; // Safari will try and upload 0 files
		}
		
		//
		// Disable input
		//
		if ($this.is('input') && options.disableInput) {
			$this.attr('disabled', true);
		}
		
		data.continue_after_abort = true;
		
		
		//
		// Call this when we stop uploading
		//
		function upload_finished() {
			$this.triggerHandler('onFinish', [data.files.length, failures]);
			
			data.state = 'idle';
			
			if ($this.is('input')) {
				if (options.disableInput)
					$this.attr('disabled', false);
				if (options.autoclear)
					$this.val('');
			}
		}
		
		//
		// This manages the file upload
		//
		function upload_file(number) {
			if (number == data.files.length) {
				upload_finished(number, failures);
				return;
			}
			
			//
			// Files can be canceled at this point (maybe some are not supported)
			//
			var file = data.files[number];
			if (!$this.triggerHandler('onUploadStarted', [file.name, number, data.files.length])) {
				return upload_file(number + 1);
			}
			
			
			//
			// What to do if the user cancels upload
			//
			function abort() {
				if ($this.data('resumable').continue_after_abort) {
					upload_file(number + 1);
				}
				else {
					upload_finished(number, failures);
				}
			};
			
			//
			// Complete upload error
			//
			function on_error(xhr, e) {
				message = {error: null}
				
				if (xhr.status == 403)			// Forbidden - ie not logged in or not your file
					message.error = 'access denied';
				else if  (xhr.status == 406)	// Not acceptable - could not save, maybe bad params or file format. There is a message avaliable
					message.error = jQuery.parseJSON(xhr.responseText).error;	// This will always be an array
				//else if  (xhr.status == 422)	// unprocessable entity - unknown error. Could not save and no error message
				//	message['error'] = '';
				
				failures = failures + 1;
				
				$this.triggerHandler('onUploadError', [file.name, e, message]);
				if (options.halt_on_error) {
					upload_finished(number, failures);
				} else {
					upload_file(number + 1);
				}
			}
			
			
			//
			// Anything over a 1MB we chunk upload if we can slice the file
			//	FIXED in FF7.0!! -Removed mozSlice as it doesn't send a file name so the data is ignored by rack-
			//
			if(file.size > (1024 * 1024) && typeof(file.slice || file.webkitSlice || file.mozSlice) == 'function') {
				var theurl = (typeof(options.baseURL) == 'function' ? options.baseURL() : options.baseURL) + '/resumable_upload.json',
				params = {
					'resume[file_name]': file.name,
					'resume[file_size]': file.size,
					'resume[file_modified]': file.lastModifiedDate
				};
				
				if(!!options.additionalParameters)
					params['resume[paramters]'] = JSON.stringify(typeof(options.additionalParameters) == 'function' ? options.additionalParameters(file) : options.additionalParameters);
				
				//
				// Ensure the slice method is defined
				//
				if(typeof(file.slice) != 'function')
					file.slice = file.webkitSlice || file.mozSlice;
				
				$this.data('resumable').xhr = $.ajax({
					url: theurl,
					data: params,
					type: 'GET',
					dataType: 'json',
					success: function (data, status, xhr) {
						var retries = 0;
						
						function sendChunk(currentPart) {								
							var offset = 1024 * 1024 * currentPart;
							var limit = offset + 1024 * 1024;
							if(file.size < limit)
								limit = file.size;
							
							var chunk = file.slice(offset, limit),
								f = new FormData();
							
							f.append('id', data.file_id);
							f.append('part', currentPart);
							f.append('chunk', chunk);
							
							$this.data('resumable').xhr = $.ajax({
								url: theurl,
								type: 'POST',
								data: f,
								processData: false,		// Do not process the data
								contentType: false,
								xhr: function() {
									var xhr = new XMLHttpRequest();
									$this.data('resumable').xhr = xhr;
									xhr.upload['onprogress'] = function(rpe){
										$this.triggerHandler('onUploadProgress', [(offset + rpe.loaded) / file.size, file.name, number, data.files.length]);
									};
									return xhr;
								},
								dataType: 'json',
								success: function (data, status, xhr) {
									if(data.next_part == false) {
										$this.triggerHandler('onUploadFinish', [xhr.responseText, file.name, number, data.files.length]);
										upload_file(number + 1);
									} else {
										retries = 0;
										sendChunk(data.next_part);
									}
								},
								error: function (xhr, status, error) {
									if(status == 'abort')
										abort();
									else {
										if(options.retry_part_errors && retries < options.retry_limit) {
											retries = retries + 1;
											sendChunk(currentPart);
										}
										else
											on_error(xhr, error);
									}
								}
							});
						}
						
						sendChunk(data.next_part);
					},
					error: function (xhr, status, error) {
						if(status == 'abort')
							abort();
						else
							on_error(xhr, error);
					}
				});
				
			//
			// Smaller files are uploaded as per-usual (HTML5 Style)
			//
			} else {
				var f = new FormData(),
					params;
				
				if(!!options.additionalParameters)
					f.append('custom', JSON.stringify(typeof(options.additionalParameters) == 'function' ? options.additionalParameters(file) : options.additionalParameters));
									
				f.append('uploaded_file', file);
				
				$.ajax({
					url: (typeof(options.baseURL) == 'function' ? options.baseURL() : options.baseURL) + '/regular_upload.json',
					type: 'POST',
					data: f,
					dataType: 'json',
					processData: false,		// Do not process the data
					contentType: false,
					xhr: function() {
						var xhr = new XMLHttpRequest();
						$this.data('resumable').xhr = xhr;
						xhr.upload['onprogress'] = function(rpe){
							$this.triggerHandler('onUploadProgress', [rpe.loaded / rpe.total, file.name, number, data.files.length]);
						};
						return xhr;
					},
					beforeSend: function (xhr) {
						$.each(options.http_headers, function(key,val){
							val = typeof(val) == 'function' ? val(file) : val;	// resolve value
							if (val === false)
								return true;		// if resolved value is boolean false, do not send this header
							xhr.setRequestHeader(key, val);
						});
					},
					success: function (data, status, xhr) {
						$this.triggerHandler('onUploadFinish', [xhr.responseText, file.name, number, data.files.length]);
						upload_file(number + 1);
					},
					error: function (xhr, status, error) {
						on_error(xhr, error);
					},
					complete: function(xhr, status) {
						if(status == 'abort')
							abort();
					}
				});
			}
		}
		
		
		upload_file(0);
		return true;
	}
	
	
	//
	// Helper function to obtain the files from the HTML5 Input element
	//
	function upload_input($this) {
		add_files($this, $this[0].files);
	}
	
	
	function add_files($this, files) {
		var data = $this.data('resumable');
		
		if(data.state == 'idle') {
			data.state = 'uploading';
			data.files = files;
			upload($this);
		} else {
			var result = $this.triggerHandler('onAppendFiles', [files])
			
			//
			// Add the files to the list
			//
			if(result === undefined)
				result = files;
			
			data.files.push.apply(data.files, files);
		}
	}
	
	
	//
	// This allows us to check for drag and drop upload support
	//
	$.extend($.support, {
		filereader: !!window.FileReader,	// Tests for support for the HTML5 File API (http://dev.w3.org/2006/webapi/FileAPI/)
		formdata: !!window.FormData			
	});
	
	
	//
	// 
	//
	var methods = {
		init: function(settings){
			var events = ['onStart', 'onAppendFiles', 'onUploadStarted', 'onUploadProgress', 'onUploadFinish', 'onUploadError', 'onFinish'],
			
				options = jQuery.extend({
					//
					// Progress events
					//	If you set here you can cancel all uploads from the onStart
					//	or the current upload onUploadStarted
					//
					//onStart: return modified file list or undefined,			// Passed: (event, file list)
					//onAppendFiles: return modified file list or undefined,	// Passed: (event, file list)
					//onUploadStarted: returning false will skip the file,		// Passed: (event, name, number, total)
					//onUploadProgress:					// Passed: (event, progress, name, number, total)
					//onUploadFinish:					// Passed: (event, response, name, number, total)
					//onUploadError:					// Passed: (event, name, error, messages)
					//onFinish:							// Passed: (event, total, failures)
					
					
					//
					// Application data required
					//
					additionalParameters: {},	//JS Object or function(file)
					baseURL: '/uploads',		// resumable_upload, regular_upload

					autostart: true,			// On change if using input box
					autoclear: true,			// Clears the file upload input box once complete
					disableInput: true,
					http_headers: {
						'Cache-Control':'no-cache',
						'X-Requested-With':'XMLHttpRequest',
						'X-File-Name': function(file){return file.name},
						'X-File-Size': function(file){return file.size}
					},
					
					retry_part_errors: false,	// Applies only to resumable uploads (auto detected)
					retry_limit: 3,				// Number of part retries before giving up
					
					halt_on_error: false		// Stop uploading further files
				}, settings || {}),
				
				data = {
					continue_after_abort: true,	// Shared xhr, settings etc
					xhr: new XMLHttpRequest(),
					options: options,
					count: 0,
					state: 'idle',
					files: []
				};
			
			
			//
			// Bind to all the elements any events specified
			//
			for (event in events) {
				if (!!options[events[event]]) {
					this.bind(events[event] + '.resumable', options[events[event]]);
				}
			}
			this.bind({
				'start.resumable': methods.start,
				'cancelCurrent.resumable': methods.cancelCurrent,
				'cancelAll.resumable': methods.cancelAll,
				'destroy.resumable': methods.destroy
			});
			
			return this.each(function() {
				var $this = $(this);
				
				//
				// If it exists then destroy it before creating a new one
				//
				if(!!$this.data('resumable'))
					$this.resumable('destroy');
				
				
				$this.data('resumable', data);
				data.count += 1;
				
				
				//
				// Bind the appropriate events (Depending on the object type)
				//
				if ($this.is('input')) {
					if (options.autostart) {
						$this.bind('change.resumable', function() {
							upload_input($this);
						});
					}
				} else {
					$this.bind('drop.resumable', function(evt) {
						add_files($this, evt.originalEvent.dataTransfer.files);
						return false;
					});
				}
			});
		},
		destroy: function() {
			return this.each(function(){
				var $this = $(this),
					data = $this.data('resumable');
				
				if(!!data) {
					data.count -= 1;
					
					//
					// Only abort if this is the last upload elemnt sharing these settings
					//
					if(data.count <= 0) {
						$this.resumable('cancelAll');
					}
					
					//
					// Remove related events and data
					//
					$this.unbind('.resumable');
					$this.removeData('resumable');
				}
			});
		},
		start: function() {
			return this.each(function(){
				var $this = $(this);
				
				if(!!$this.data('resumable')) {
					if ($this.is('input'))
						upload_input($this);
				}
			});
		},
		cancelCurrent: function() {
			return this.each(function(){
				var $this = $(this),
					data = $this.data('resumable');
				
				if(!!data && data.state != 'idle') {
					try{
						data.xhr.abort();
					} catch(e) {}
				}
			});
		},
		cancelAll: function() {
			return this.each(function(){
				var $this = $(this),
					data = $this.data('resumable');
				
				if(!!data) {
					data.continue_after_abort = false;
					
					if(data.state != 'idle') {
						try{
							data.xhr.abort();
						} catch(e) {}
					}
				}
			});
		}
	};
	
	
	//
	// Method proxy
	//
	$.fn.resumable = function(method) {
		if ( !!methods[method] ) {
			return methods[ method ].apply( this, Array.prototype.slice.call( arguments, 1 ));
		} else if ( typeof method === 'object' || !!!method ) {	
			return methods.init.apply( this, arguments );
		} else {
			$.error( 'Method ' +  method + ' does not exist on jQuery.resumable' );
		}
	};
	
})(jQuery);