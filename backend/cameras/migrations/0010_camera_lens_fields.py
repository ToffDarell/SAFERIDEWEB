from django.db import migrations, models


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
        ('cameras', '0009_systemsettings_database_backup_enabled_and_more'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(ensure_camera_lens_fields, migrations.RunPython.noop),
            ],
            state_operations=[
                migrations.AddField(
                    model_name='camera',
                    name='active_lens',
                    field=models.CharField(
                        choices=[('wide', 'Wide'), ('tele', 'Tele')],
                        default='wide',
                        max_length=20,
                    ),
                ),
                migrations.AddField(
                    model_name='camera',
                    name='preferred_lens',
                    field=models.CharField(
                        choices=[('wide', 'Wide'), ('tele', 'Tele')],
                        default='wide',
                        max_length=20,
                    ),
                ),
                migrations.AddField(
                    model_name='camera',
                    name='supports_lens_switching',
                    field=models.BooleanField(default=False),
                ),
            ],
        ),
    ]
