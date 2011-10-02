//= require resolute/aca-i18n


/**
*	jQuery.resumable()
*	This provides HTML5 uploads with a resume function if it is avaliable.
*	
*   Copyright (c) 2011 Advanced Control and Acoustics, based on code by Mihail Dektyarow
*	
*	@author 	Stephen von Takach <steve@advancedcontrol.com.au>
* 	@copyright  2011 advancedcontrol.com.au
*	@version    1.0
**/


(function($) {
	
	
	//
	// This allows us to check for drag and drop upload support
	//
	$.extend($.support, {
		filereader: !!window.FileReader,	// Tests for support for the HTML5 File API (http://dev.w3.org/2006/webapi/FileAPI/)
		formdata: !!window.FormData			
	});
	
	
	//
	// HTML5 Resumable Upload code
	//
	jQuery.fn.resumable = function(options) {
		var events = ['onStart', 'onUploadStarted', 'onUploadProgress', 'onUploadFinish', 'onUploadError', 'onFinish'],
			options = jQuery.extend({
				//
				// Progress callbacks
				//
				onStart: function(event, total) {
					return true;
				},
				onUploadStarted: function(event, name, number, total) {
					return true;
				},
				onUploadProgress: function(event, progress, name, number, total) { },
				onUploadFinish: function(event, response, name, number, total) { },
				onUploadError: function(event, name, error, messages) { },
				onFinish: function(event, total, failures) { },
				
				
				//
				// Status feedback options
				//
				setName: function(text) { },
				setStatus: function(text) { },
				setProgress: function(value) { },
				genName: function(file, number, total) {
					return translate(i18n_resumables.progress, file, (number + 1), total);
				},
				genStatus: function(progress, finished) {
					if (finished) {
						return i18n_resumables.status.FINISHED;
					}
					if (progress == 0) {
						return i18n_resumables.status.STARTED;
					}
					else if (progress == 1) {
						return i18n_resumables.status.UPLOADED;
					}
					else {
						return i18n_resumables.status.UPLOADING;
					}
				},
				genProgress: function(loaded, total) {
					return loaded / total;
				},
				
				
				//
				// Application data required
				//
				additionalParameters: {},//JS Object or function(file)
				baseURL: '/uploads',	// resumable_upload, regular_upload
				
				
				
				//
				// Behavioural options
				//
				startDragHover: function(){},
				endDragHover: function(){},
				
				autostart: true,			// On change if using input box
				autoclear: true,			// Clears the file upload input box once complete
				http_headers: {
					'Cache-Control':'no-cache',
					'X-Requested-With':'XMLHttpRequest',
					'X-File-Name': function(file){return file.name},
					'X-File-Size': function(file){return file.size}
				},
				
				retry_part_errors: false,	// Applies only to resumable uploads (auto detected)
				retry_limit: 3,				// Number of part retries before giving up
				
				halt_on_error: false		// Stop uploading further files
			}, options),
			$this = $(this);	// End var declaration
		
		
		//
		// Uploads files using HTML5 FileAPI
		//
		function upload(files) {
			var total = files.length,
				failures = 0;
				
			if (total == 0) {
				return false; // Safari will try and upload 0 files
			}
			if (!$this.triggerHandler('onStart.uploader', [total])) {
				return false;
			}
			
			if ($this.is('input')) {
				$this.attr('disabled', true);
			}
			var uploaded = 0;
			$this.data('uploader')['continue_after_abort'] = true;
			
			
			//
			// Call this when we stop uploading
			//
			function upload_finished(number, failures) {
				$this.trigger('onFinish.uploader', [number, failures]);
				
				if ($this.is('input')) {
					$this.attr('disabled', false);
					if (options.autoclear) {
						$this.val('');
					}
				}
			}
			
			//
			// This manages the file upload
			//
			function upload_file(number) {
				if (number == total) {
					upload_finished(number, failures);
					options.setStatus(options.genStatus(1, true));
					return;
				}
				
				var file = files[number];
				if (!$this.triggerHandler('onUploadStarted.uploader', [file.name, number, total])) {
					return upload_file(number + 1);
				}
				options.setStatus(options.genStatus(0));
				options.setName(options.genName(file.name, number, total));
				options.setProgress(options.genProgress(0, file.size));
				
				
				//
				// What to do if the user cancels upload
				//
				function abort() {
					if ($this.data('uploader')['continue_after_abort']) {
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
					
					$this.trigger('onUploadError.uploader', [file.name, e, message]);
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
					
					$this.data('uploader')['xhr'] = $.ajax({
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
								
								$this.data('uploader')['xhr'] = $.ajax({
									url: theurl,
									type: 'POST',
									data: f,
									processData: false,		// Do not process the data
									contentType: false,
									xhr: function() {
										var xhr = new XMLHttpRequest();
										$this.data('uploader')['xhr'] = xhr;
										xhr.upload['onprogress'] = function(rpe){
											$this.trigger('onUploadProgress.uploader', [(offset + rpe.loaded) / file.size, file.name, number, total]);
											options.setStatus(options.genStatus((offset + rpe.loaded) / file.size));
											options.setProgress(options.genProgress((offset + rpe.loaded), file.size));
										};
										return xhr;
									},
									dataType: 'json',
									success: function (data, status, xhr) {
										if(data.next_part == false) {
											$this.triggerHandler('onUploadFinish.uploader', [xhr.responseText, file.name, number, total]);
											options.setStatus(options.genStatus(1, true));
											options.setProgress(options.genProgress(file.size, file.size));
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
							$this.data('uploader')['xhr'] = xhr;
							xhr.upload['onprogress'] = function(rpe){
								$this.trigger('onUploadProgress.uploader', [rpe.loaded / rpe.total, file.name, number, total]);
								options.setStatus(options.genStatus(rpe.loaded / rpe.total));
								options.setProgress(options.genProgress(rpe.loaded, rpe.total));
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
							$this.triggerHandler('onUploadFinish.uploader', [xhr.responseText, file.name, number, total]);
							options.setStatus(options.genStatus(1, true));
							options.setProgress(options.genProgress(file.size, file.size));
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
		function upload_input() {
			upload($this[0].files);
		}
		
		return $this.each(function() {
			$this.data('uploader', {
				continue_after_abort: true,
				xhr: new XMLHttpRequest()
			});

			//
			// Bind the appropriate events (Depending on the object type)
			//
			if ($this.is('input')) {
				if (options.autostart)
					$this.bind('change.uploader', upload_input);
			}
			else {
				$this.bind({
					'dragenter.uploader': function() {
						options.startDragHover();
						return false;
					},
					'dragleave.uploader': function() {
						options.endDragHover();
						//return false;
					},
					'dragover.uploader': function() {
						options.startDragHover();
						return false;
					},
					'drop.uploader': function(evt) {
						options.endDragHover();
						//try {
							upload(evt.originalEvent.dataTransfer.files);
						//}
						//catch (err) {
							// Anything not implementing File API will fail here
						//	alert(err);
						//}
						return false;
					}
				});
			}


			//
			// Bind the callbacks
			//
			for (event in events) {
				if (!!options[events[event]]) {
					$this.bind(events[event] + '.uploader', options[events[event]]);
				}
			}

			//
			// Bind the other callable functions
			//
			$this.bind({
				'start.uploader': upload_input,
				'cancelCurrent.uploader': function() {
					$this.data('uploader')['xhr'].abort();
				},
				'cancelAll.uploader': function() {
					$this.data('uploader')['continue_after_abort'] = false;
					$this.data('uploader')['xhr'].abort();
				},
				'destroy.uploader': function() {
					$this.data('uploader')['continue_after_abort'] = false;
					try{
						$this.data('uploader')['xhr'].abort();	// if active
					} catch(e) {}
					
					//
					// Remove related events and data
					//
					$this.unbind('.uploader');
					$this.removeData('uploader');
				}
			});
		});
	};
})(jQuery);