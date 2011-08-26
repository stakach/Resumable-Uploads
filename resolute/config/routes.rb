Resolute::Engine.routes.draw do
	
	match	:resumable_upload,	:via => [:get, :post]
	match	:regular_upload,	:via => :post
	
end
