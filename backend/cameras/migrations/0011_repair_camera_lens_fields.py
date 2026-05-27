from django.db import migrations


def get_existing_columns(schema_editor, table_name):
    with schema_editor.connection.cursor() as cursor:
        return {
            column.name
            for column in schema_editor.connection.introspection.get_table_description(cursor, table_name)
        }


def ensure_camera_lens_fields(apps, schema_editor):
    Camera = apps.get_model('cameras', 'Camera')
    table_name = Camera._meta.db_table
    quote_name = schema_editor.quote_name
    existing_columns = get_existing_columns(schema_editor, table_name)

    columns_to_add = [
        ('active_lens', "varchar(20) NOT NULL DEFAULT 'wide'"),
        ('preferred_lens', "varchar(20) NOT NULL DEFAULT 'wide'"),
        ('supports_lens_switching', 'bool NOT NULL DEFAULT 0'),
    ]

    for column_name, column_definition in columns_to_add:
        if column_name in existing_columns:
            continue

        schema_editor.execute(
            f'ALTER TABLE {quote_name(table_name)} '
            f'ADD COLUMN {quote_name(column_name)} {column_definition}'
        )
        existing_columns.add(column_name)


class Migration(migrations.Migration):

    dependencies = [
        ('cameras', '0010_camera_lens_fields'),
    ]

    operations = [
        migrations.RunPython(ensure_camera_lens_fields, migrations.RunPython.noop),
    ]
