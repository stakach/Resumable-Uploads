require "resolute/engine"

module Resolute
	#
	# Default resumable settings go here
	#
	@@upload_folder = 'tmp/uploading'			# Temp storage location while uploading is occuring.
	mattr_accessor :upload_folder
	
	#
	# Resturns unique user identifier
	#
    def self.current_user(&block)
		@current_user = block if block
		@current_user
	end
	def self.current_user=(proc)
		@current_user = proc
	end
	
	#
	# Will delete DB entry once this returns.
	# => Returning false means the save failed (upload won't be destroyed)
	#
	def self.upload_completed(&block)
		@completed_callback = block if block
		@completed_callback
	end
	def self.upload_completed=(proc)
		@completed_callback = proc
	end
	
	#
	# For checking if the file format is supported before saving
	#
	def self.check_supported(&block)
		@supported_callback = block if block
		@supported_callback
	end
	def self.check_supported=(proc)
		@supported_callback = proc
	end
	self.check_supported = Proc.new {|file_info| return true}	# Default accept all
end
