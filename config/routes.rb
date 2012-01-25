Resolute::Engine.routes.draw do
	
	match	'/resumable_upload' => 'resumables#resumable_upload',	:via => [:get, :post]
	match	'/regular_upload' => 'resumables#regular_upload',		:via => :post
	
	#
	# Used for testing only
	#
	#root	:to => 'resumables#index',	:via => :get
	#match	'/load_session' => 'resumables#load_session',		:via => :get
	
end
