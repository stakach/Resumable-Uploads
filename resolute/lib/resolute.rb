require "resolute/engine"

module Resolute
	mattr_accessor :current_user_callback
	mattr_accessor :uploading_path
	mattr_accessor :completed_callback
	
	#
	# Default resumable settings go here
	#
	@@uploading_path = 'tmp/uploading'			# For temp storage while uploading is occuring.
	@@current_user_callback = nil				# Get unique user identifier
	@@completed_callback = nil					# Will delete DB entry once this returns.
end
