desc "A delayed job worker that cleans up resumables have not been resumed in over 1 week"
task :resolute_cleanup do
	Delayed::Worker.new(:quiet => false).start
end
