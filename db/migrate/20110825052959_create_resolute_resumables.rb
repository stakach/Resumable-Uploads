class CreateResoluteResumables < ActiveRecord::Migration
	def change
		create_table :resolute_resumables do |t|
			t.string	:user_id,			:allow_null => false
			
			t.text		:paramters
			
			t.string	:file_name,		:allow_null => false
			t.integer	:file_size,		:allow_null => false
			t.datetime	:file_modified
			t.text		:file_location,	:allow_null => false
			
			t.timestamps
		end
	end
end
