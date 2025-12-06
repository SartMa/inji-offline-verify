export interface ErrorVisitor {
	visitError(error: any): void;
	getMessages(): string[];
	reset(): void;
}

export class MessageCollectorVisitor implements ErrorVisitor {
	private messages: string[] = [];

	visitError(error: any): void {
		if (!error) return;

		const walk = (err: any) => {
			if (!err) return;
			if (typeof err.message === 'string') {
				this.messages.push(err.message);
			}
			if (Array.isArray(err.errors)) {
				err.errors.forEach(walk);
			}
			if (Array.isArray(err.details)) {
				err.details.forEach(walk);
			}
		};

		walk(error);
	}

	getMessages(): string[] {
		return this.messages;
	}

	reset(): void {
		this.messages = [];
	}
}
