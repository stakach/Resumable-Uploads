###
#
#	Copyright (c) 2011 Advanced Control and Acoustics
#
#	@author 	Stephen von Takach <steve@advancedcontrol.com.au>
#	@copyright  2011 advancedcontrol.com.au
#	@license	GNU LESSER GENERAL PUBLIC LICENSE Version 3
#
###

module Resolute
	class Resumable < ActiveRecord::Base
		before_validation	:ready_file
		
		
		def next_part
			size = File.size(file_location)
			return size >= file_size ? false : size / (1024 * 1024)	# Bigger just in case. We don't want to get into a loop
		end
		
		def apply_part(part, chunk)
			next_p = next_part
			
			if next_p == false || next_p != part
				return next_p
			end
			
			offset = next_p * (1024 * 1024)
			file = File.open(file_location, 'ab')
			
			#
			# Check file integrity (a partial write may have caused the failure)
			#
			if file.size != offset
				file.seek(offset - 1, IO::SEEK_SET)
				file.truncate(offset)
			end
			
			file.write(chunk.read)
			file.close
			
			next_part
		end
		
		
		#
		# Store any custom params that were passed with this object
		#
		def custom_params
			if self[:custom_params].nil?
				return {}
			end
			JSON.parse(self[:custom_params], {:symbolize_names => true})
		end
		
		##
		# Not needed as sent to the server as a JSON string
		#def paramters=(paramHash)
		#	self[:paramters] = paramHash.to_json
		#end
		
		#
		# Assumes delayed_job is in use (not required)
		#
		def self.clean_up
			Resumable.where('updated_at < ?', Time.now - 1.week).each do |resumable|
				begin
					resumable.destroy
					File.delete(resumable.file_location)
				rescue
				end
			end
			
			self.delay({:run_at => 1.day.from_now, :queue => 'clean'}).clean_up
		end
		
		
		protected
		
		
		def ready_file
			self.file_location = Resumable.sanitize_filename(self.file_name, self.user_id)
			
			File.new(self.file_location, 'wb').close	# Create the file
			FileUtils.chmod 0666, self.file_location
		end
		
		
		def self.sanitize_filename(filename, user)
			# get only the filename, not the whole path (HTML5 renders this needless I'll keep it anyway)
			filename = filename.gsub(/^.*(\\|\/)/, '')
			# NOTE: File.basename doesn't work right with Windows paths on Unix
			# INCORRECT: just_filename = File.basename(value.gsub('\\\\', '/'))
			
			# Finally, replace all non alphanumeric or periods with underscore
			newname = "#{Time.now.to_i}#{File.extname(filename.gsub(/[^\w\.\-]/,'_'))}"
			filepath = File.join(Resolute.upload_folder, user.to_s.gsub(/[^\w\.\-]/,'_'))
			
			FileUtils.makedirs filepath
			FileUtils.chmod 0777, filepath
			return File.join(filepath, newname)
		end
		
		
		validates_presence_of :user_id, :file_name, :file_size, :file_location
	end
end
