module Resolute
	class ResumablesController < ApplicationController
		def resumable_upload
			user = get_current_user
			raise "Security Transgression" if user.nil?
			
			
			if request.get?
				#
				# Request an upload id for the file described
				#
				resume = Resumable.new(params[:resume].merge({:user_id => user.to_s}))
				found = Resumable.where('user_id = ? AND file_name = ? AND file_size = ?',
					resume.user_id, resume.file_name, resume.file_size)
					
				if(resume.file_modified.nil?)	# Browsers may not send this. We'll use it if we can
					found = found.where('file_modified IS NULL').first
				else
					found = found.where('file_modified = ?', resume.file_modified).first
				end
				
				#
				# Is there an existing file? If not create an entry for this one
				#
				if(found.nil?)
					#
					# TODO:: Put in hooks to check if file is a valid format before upload
					# => We'll provide JS callbacks for handling this
					#
					resume.save
				else
					resume = found
				end
				
				render :json => {:file_id => resume.id, :next_part => resume.next_part}, :layout => false
			else
				#
				# Recieve a chunk of data and save it
				#
				resume = Resumable.find(params[:id])
				raise "Security Transgression" unless resume.user_id == user.to_s
				
				next_part = resume.apply_part(params[:part].to_i, params[:chunk])
				
				if next_part == false
					inform_upload_completed(resume.file_name, resume.file_location, resume.paramters)
				end
				render :json => {:next_part => next_part}, :layout => false
			end
		end
		
		
		def regular_upload	# Well still HTML5 (just not multi-part)
			user = get_current_user
			raise "Security Transgression" if user.nil?
			
			filepath = Resumable.sanitize_filename(params[:uploaded_file].original_filename, user)
			
			#
			# TODO:: Put in hooks to check if file is the correct format before copy
			# => The copy allows us to process in the background without it being deleted
			# => We'll provide JS hooks to inform the user if this is the case
			#
			FileUtils.cp params[:uploaded_file].tempfile.path, filepath	# file copy here
			inform_upload_completed(params[:uploaded_file].original_filename, filepath, params[:custom])
			
			render :nothing => true, :layout => false
		end
		
		
		protected
		
		#
		# Will work with a proc or lambda
		#
		def get_current_user
			return Resolute.current_user_callback.call
		end
		
		def inform_upload_completed(oringinal_name, current_path, custom_parameters)
			Resolute.completed_callback.call(oringinal_name, current_path, custom_parameters)
		end
	end
end
