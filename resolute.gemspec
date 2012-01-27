$:.push File.expand_path("../lib", __FILE__)

# Maintain your gem's version:
require "resolute/version"

# Describe your gem and declare its dependencies:
Gem::Specification.new do |s|
  s.name        = "resolute"
  s.version     = Resolute::VERSION
  s.authors     = ["Stephen von Takach"]
  s.email       = ["steve@advancedcontrol.com.au"]
  s.homepage    = "http://advancedcontrol.com.au/"
  s.summary     = "Resumable file uploads in HTML5"
  s.description = "Provides code to manage and simplify resumable file uploads"

  s.files = Dir["{app,config,db,lib}/**/*"] + ["LGPL3-LICENSE", "Rakefile", "README.textile"]
  s.test_files = Dir["test/**/*"]

  s.add_dependency "rails"
  s.add_dependency "jquery-rails"

  s.add_development_dependency "sqlite3"
end
