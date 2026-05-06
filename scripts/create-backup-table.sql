create table if not exists backup_transactions (
  id varchar(36) primary key,
  type varchar(20) not null,
  amount decimal(15, 2) not null,
  category varchar(100) not null,
  transaction_date date not null,
  memo text null,
  item_name varchar(100) null,
  box_count int null,
  auction_price decimal(15, 2) null,
  created_at datetime null,
  updated_at datetime null,
  backed_up_at datetime not null default current_timestamp on update current_timestamp
);
